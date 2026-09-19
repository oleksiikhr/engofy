import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import type { GrammarContrastiveResult } from '../../domain/grammar-contrastive-prompt.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { ExerciseSource } from '../../enums/exercise-source.enum.js';
import { ExerciseType } from '../../enums/exercise-type.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
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
  options: ['jumped', 'was jumping', 'has jumped'],
  answerIndex: 0,
  optionExplanations: [
    'A completed past action.',
    'Describes an action in progress.',
    'Links the past to now.',
  ],
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

  const past = new GrammarCategory();
  past.name = 'PAST';
  past.sortOrder = 0;
  const lone = new GrammarCategory();
  lone.name = 'LONE';
  lone.sortOrder = 1;
  em.persist([past, lone]);

  const construct = (
    category: GrammarCategory,
    name: string,
    slug: string,
    sortOrder: number,
  ) => {
    const construction = new GrammarConstruction();
    construction.categoryId = category.id;
    construction.name = name;
    construction.slug = slug;
    construction.sortOrder = sortOrder;
    em.persist(construction);
    return construction;
  };
  const point = (construction: GrammarConstruction, guideword: string) => {
    const usagePoint = new GrammarUsagePoint();
    usagePoint.constructionId = construction.id;
    usagePoint.cefrLevel = CefrLevel.A2;
    usagePoint.guideword = guideword;
    usagePoint.canDoStatement = `can do ${guideword}`;
    em.persist(usagePoint);
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
    const match = new GrammarMatch();
    match.sentenceId = sentence.id;
    match.grammarUsagePointId = usagePoint.id;
    match.tokenStart = tokenStart;
    match.tokenEnd = tokenEnd;
    em.persist(match);
  }
  await em.flush();
  return { pastSimplePointId: pastSimple.id, sentenceId: sentence.id };
}

async function seedPostWithSentence(em: EntityManager): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = SENTENCE_TEXT;

  const post = new Post();
  post.source = source;
  em.persist(post);

  const sentence = new Sentence();
  sentence.postId = post.id;
  sentence.postPartId = uuidv7();
  sentence.unitIndex = 0;
  sentence.position = 0;
  sentence.rawText = SENTENCE_TEXT;
  sentence.charStart = 0;
  sentence.charEnd = SENTENCE_TEXT.length;
  em.persist(sentence);

  TOKENS.forEach(
    ([charStart, charEnd, text, lemma, pos, tag, dep], position) => {
      const token = new SentenceToken();
      token.sentenceId = sentence.id;
      token.position = position;
      token.text = text;
      token.charStart = charStart;
      token.charEnd = charEnd;
      token.lemma = lemma;
      token.pos = pos;
      token.tag = tag;
      token.dep = dep;
      token.morph = {};
      em.persist(token);
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
      ...FIXTURE_CONTRASTIVE,
    });

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
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'x';
    const post = new Post();
    post.source = source;
    suite.orm.em.persist(post);
    await suite.orm.em.flush();
    const postId = post.id;
    suite.orm.em.clear();

    await expect(
      suite.command(new GenerateExercisesCommand(postId)),
    ).rejects.toThrow('no sentences');
  });
});
