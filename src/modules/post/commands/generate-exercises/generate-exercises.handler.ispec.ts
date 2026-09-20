import type { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import { AiSchemaMismatchError } from '../../../../core/ai/ai-schema-mismatch.error.js';
import type { GrammarContrastiveResult } from '../../domain/grammar-contrastive-prompt.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { ExerciseSource } from '../../enums/exercise-source.enum.js';
import { ExerciseType } from '../../enums/exercise-type.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { GenerateExercisesCommand } from './generate-exercises.command.js';

// "The clever fox jumped over lazy dogs." — token position -> [start, end,
// text, lemma, pos, tag, dep].
const SENTENCE_TEXT = 'The clever fox jumped over lazy dogs.';
const TOKENS: [number, number, string, string, string, string, string][] = [
  [0, 3, 'The', 'the', 'DET', 'DT', 'det'],
  [4, 10, 'clever', 'clever', 'ADJ', 'JJ', 'amod'],
  [11, 14, 'fox', 'fox', 'NOUN', 'NN', 'nsubj'],
  [15, 21, 'jumped', 'jump', 'VERB', 'VBD', 'ROOT'],
  [22, 26, 'over', 'over', 'ADP', 'IN', 'prep'],
  [27, 31, 'lazy', 'lazy', 'ADJ', 'JJ', 'amod'],
  [32, 36, 'dogs', 'dog', 'NOUN', 'NNS', 'pobj'],
  [36, 37, '.', '.', 'PUNCT', '.', 'punct'],
];

const FIXTURE_CONTRASTIVE: GrammarContrastiveResult = {
  explanation:
    'Past simple states a finished action; past continuous would describe it in progress.',
  question: 'The clever fox ____ over lazy dogs.',
  correctOption: 'jumped',
  correctExplanation: 'A completed past action.',
  wrongOption1: 'was jumping',
  wrongExplanation1: 'Describes an action in progress.',
  wrongOption2: 'has jumped',
  wrongExplanation2: 'Links the past to now.',
};

interface SeededGrammar {
  pastSimplePointId: string;
  sentenceId: string;
}

// Two constructions in one category ("past simple" matched on "jumped", plus a
// sibling "past continuous") and a lone-construction category matched on
// "lazy dogs" — nothing to contrast with, so it must be skipped.
async function seedGrammar(
  em: EntityManager,
  postId: string,
): Promise<SeededGrammar> {
  const sentence = await em.findOneOrFail(Sentence, { postId });

  const past = factories(em).grammarCategory.makeOne({
    name: 'PAST',
    sortOrder: 0,
  });
  const lone = factories(em).grammarCategory.makeOne({
    name: 'LONE',
    sortOrder: 1,
  });

  const construct = (
    category: GrammarCategory,
    name: string,
    slug: string,
    sortOrder: number,
  ) => {
    const construction = factories(em).grammarConstruction.makeOne({
      categoryId: category.id,
      name,
      slug,
      sortOrder,
    });
    return construction;
  };
  const point = (construction: GrammarConstruction, guideword: string) => {
    const usagePoint = factories(em).grammarUsagePoint.makeOne({
      constructionId: construction.id,
      cefrLevel: CefrLevel.A2,
      guideword,
      canDoStatement: `can do ${guideword}`,
    });
    return usagePoint;
  };
  const pastSimple = point(
    construct(past, 'past simple', 'past-simple', 0),
    'USE: FINISHED PAST',
  );
  point(
    construct(past, 'past continuous', 'past-continuous', 1),
    'USE: ACTION IN PROGRESS',
  );
  const loneUsage = point(
    construct(lone, 'adjectives', 'adjectives', 0),
    'USE: DESCRIBING',
  );

  for (const [usagePoint, tokenStart, tokenEnd] of [
    [pastSimple, 3, 4],
    [loneUsage, 5, 7],
  ] as const) {
    const _match = factories(em).grammarMatch.makeOne({
      sentenceId: sentence.id,
      grammarUsagePointId: usagePoint.id,
      tokenStart,
      tokenEnd,
    });
  }
  await em.flush();
  return { pastSimplePointId: pastSimple.id, sentenceId: sentence.id };
}

async function seedPostWithSentence(em: EntityManager): Promise<string> {
  const source = { format: PostSourceFormat.Text, rawText: SENTENCE_TEXT };

  const post = factories(em).post.makeOne({
    status: PostStatus.Pending,
    source,
  });

  const sentence = factories(em).sentence.makeOne({
    postId: post.id,
    postPartId: uuidv7(),
    unitIndex: 0,
    position: 0,
    rawText: SENTENCE_TEXT,
    charStart: 0,
    charEnd: SENTENCE_TEXT.length,
  });

  TOKENS.forEach(
    ([charStart, charEnd, text, lemma, pos, tag, dep], position) => {
      const _token = factories(em).sentenceToken.makeOne({
        sentenceId: sentence.id,
        position,
        text,
        charStart,
        charEnd,
        lemma,
        pos,
        tag,
        dep,
        morph: {},
      });
    },
  );

  await em.flush();
  return post.id;
}

describe('GenerateExercisesHandler', () => {
  const fakeAi = new FakeAiClient();
  fakeAi.onCompleteStructured = () => FIXTURE_CONTRASTIVE;
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  beforeEach(() => {
    fakeAi.structuredCallCount = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes deterministic exercises plus one grammar_contrastive per contrastable usage point and completes the run', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);
    const grammar = await seedGrammar(suite.orm.em, postId);
    const prompts: { system: string; userText: string }[] = [];
    fakeAi.onCompleteStructured = (params) => {
      prompts.push(params);
      return FIXTURE_CONTRASTIVE;
    };

    await suite.command(new GenerateExercisesCommand(postId));

    const exercises = await suite.orm.em.find(Exercise, { postId });
    expect(
      exercises.filter((e) => e.source === ExerciseSource.Spacy).length,
    ).toBeGreaterThan(0);

    const contrastive = exercises.filter(
      (e) => e.type === ExerciseType.GrammarContrastive,
    );
    expect(contrastive).toHaveLength(1);
    expect(contrastive[0]?.source).toBe(ExerciseSource.Ai);
    expect(contrastive[0]?.payload).toEqual({
      grammarUsagePointId: grammar.pastSimplePointId,
      sentenceId: grammar.sentenceId,
      explanation: FIXTURE_CONTRASTIVE.explanation,
      question: FIXTURE_CONTRASTIVE.question,
      options: expect.arrayContaining(['jumped', 'was jumping', 'has jumped']),
      answerIndex: expect.any(Number),
      optionExplanations: expect.arrayContaining([
        'A completed past action.',
        'Describes an action in progress.',
        'Links the past to now.',
      ]),
    });

    const payload = contrastive[0]?.payload as {
      options: string[];
      answerIndex: number;
    };
    expect(payload.options[payload.answerIndex]).toBe('jumped');

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.userText).toContain(
      'Sentence: The clever fox ⟦jumped⟧ over lazy dogs.',
    );
    expect(prompts[0]?.userText).toContain('Construction: past simple');
    expect(prompts[0]?.userText).toContain(
      '- past continuous (USE: ACTION IN PROGRESS)',
    );

    const fillBlank = exercises.find((e) => e.type === ExerciseType.FillBlank);
    expect(fillBlank?.payload).toMatchObject({
      answer: 'clever',
      prompt: 'The ____ fox jumped over lazy dogs.',
    });

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiExercises,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('retries a malformed model payload for a usage point and keeps the exercise', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);
    await seedGrammar(suite.orm.em, postId);
    fakeAi.onCompleteStructured = () => {
      if (fakeAi.structuredCallCount < 3) {
        throw new AiSchemaMismatchError('report_grammar_contrastive');
      }
      return FIXTURE_CONTRASTIVE;
    };

    await suite.command(new GenerateExercisesCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(3);
    expect(
      await suite.orm.em.count(Exercise, {
        postId,
        type: ExerciseType.GrammarContrastive,
      }),
    ).toBe(1);
  });

  it('skips a usage point whose payload stays malformed instead of failing the stage', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);
    await seedGrammar(suite.orm.em, postId);
    fakeAi.onCompleteStructured = () => {
      throw new AiSchemaMismatchError('report_grammar_contrastive');
    };
    const logSpy = vi.spyOn(Logger.prototype, 'log');

    await suite.command(new GenerateExercisesCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(3);
    expect(
      await suite.orm.em.count(Exercise, {
        postId,
        type: ExerciseType.GrammarContrastive,
      }),
    ).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        grammarContrastive: 0,
        grammarContrastiveRequested: 1,
        grammarContrastiveSkipped: 1,
      }),
      'ai_exercises generated',
    );
    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiExercises,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('propagates a non-schema AI error so the stage retries', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);
    await seedGrammar(suite.orm.em, postId);
    fakeAi.onCompleteStructured = () => {
      throw new Error('overloaded');
    };

    await expect(
      suite.command(new GenerateExercisesCommand(postId)),
    ).rejects.toThrow('overloaded');
    expect(fakeAi.structuredCallCount).toBe(1);
  });

  it('makes no AI call when the post has no grammar matches', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new GenerateExercisesCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(0);
    expect(
      await suite.orm.em.count(Exercise, {
        postId,
        type: ExerciseType.GrammarContrastive,
      }),
    ).toBe(0);
  });

  it('is idempotent — a second run neither calls the AI again nor duplicates rows', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);
    await seedGrammar(suite.orm.em, postId);
    fakeAi.onCompleteStructured = () => FIXTURE_CONTRASTIVE;

    await suite.command(new GenerateExercisesCommand(postId));
    const callsAfterFirst = fakeAi.structuredCallCount;
    const countAfterFirst = await suite.orm.em.count(Exercise, { postId });

    await suite.command(new GenerateExercisesCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(callsAfterFirst);
    expect(await suite.orm.em.count(Exercise, { postId })).toBe(
      countAfterFirst,
    );
  });

  it('throws when spacy_parse has not produced sentences yet', async () => {
    const source = { format: PostSourceFormat.Text, rawText: 'x' };
    const post = suite.factories.post.makeOne({
      status: PostStatus.Pending,
      source,
    });
    await suite.orm.em.flush();
    const postId = post.id;
    suite.orm.em.clear();

    await expect(
      suite.command(new GenerateExercisesCommand(postId)),
    ).rejects.toThrow('no sentences');
  });
});
