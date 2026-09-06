import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import type { ComprehensionResult } from '../../domain/comprehension-prompt.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
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

const FIXTURE_COMPREHENSION: ComprehensionResult = {
  questions: [
    {
      question: 'What jumped?',
      options: ['The fox', 'The dog', 'The cat', 'The bird'],
      answerIndex: 0,
    },
    {
      question: 'How were the dogs described?',
      options: ['Lazy', 'Clever', 'Fast', 'Loud'],
      answerIndex: 0,
    },
  ],
};

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
  fakeAi.onCompleteStructured = () => FIXTURE_COMPREHENSION;
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  it('writes deterministic exercises plus AI comprehension and completes the run', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new GenerateExercisesCommand(postId));

    const exercises = await suite.orm.em.find(Exercise, { postId });
    const bySource = (s: ExerciseSource) =>
      exercises.filter((e) => e.source === s);

    expect(bySource(ExerciseSource.Spacy).length).toBeGreaterThan(0);
    expect(bySource(ExerciseSource.Ai)).toHaveLength(2);
    expect(
      exercises.filter((e) => e.type === ExerciseType.Comprehension),
    ).toHaveLength(2);

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

  it('is idempotent — a second run neither calls the AI again nor duplicates rows', async () => {
    const postId = await seedPostWithSentence(suite.orm.em);

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
