import type { EntityManager } from '@mikro-orm/postgresql';
import { factories } from '../../../../../test/factories/factories.js';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import type { Paragraph } from '../../domain/node-tree.types.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { TagGrammarCommand } from './tag-grammar.command.js';
import type { PostAiGrammarJobData } from './tag-grammar.handler.js';

const SENTENCE_TEXT = 'She had never visited Tokyo before.';
// token position -> [charStart, charEnd, text]
const TOKEN_SPEC: [number, number, string][] = [
  [0, 3, 'She'],
  [4, 7, 'had'],
  [8, 13, 'never'],
  [14, 21, 'visited'],
  [22, 27, 'Tokyo'],
  [28, 34, 'before'],
  [34, 35, '.'],
];

const DEFAULT_GRAMMAR_RESPONSE = `[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.`;

async function seedCatalog(em: EntityManager): Promise<void> {
  const category = factories(em).grammarCategory.makeOne({
    name: 'PAST',
    sortOrder: 0,
  });

  const construction = factories(em).grammarConstruction.makeOne({
    categoryId: category.id,
    name: 'past perfect',
    slug: 'past-perfect',
    sortOrder: 0,
  });

  for (const [egpIndex, cefr] of [
    [412, CefrLevel.B1],
    [999, CefrLevel.B2],
  ] as const) {
    const _usagePoint = factories(em).grammarUsagePoint.makeOne({
      constructionId: construction.id,
      egpIndex,
      cefrLevel: cefr,
      guideword: `USE ${egpIndex}`,
      canDoStatement: `can do ${egpIndex}`,
    });
  }

  await em.flush();
}

async function seedPostWithSentence(
  em: EntityManager,
  opts: { annotationCompleted?: boolean } = {},
): Promise<string> {
  const source = { format: PostSourceFormat.Text, rawText: SENTENCE_TEXT };
  const post = factories(em).post.makeOne({
    status: PostStatus.Pending,
    source,
  });

  const part = factories(em).postPart.makeOne({
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [{ type: 'text', text: SENTENCE_TEXT }],
    },
  });

  const sentence = factories(em).sentence.makeOne({
    postId: post.id,
    postPartId: part.id,
    unitIndex: 0,
    position: 0,
    rawText: SENTENCE_TEXT,
    charStart: 0,
    charEnd: SENTENCE_TEXT.length,
  });

  TOKEN_SPEC.forEach(([charStart, charEnd, text], position) => {
    const _token = factories(em).sentenceToken.makeOne({
      sentenceId: sentence.id,
      position,
      text,
      charStart,
      charEnd,
      lemma: text.toLowerCase(),
      pos: 'X',
      tag: 'XX',
      dep: 'dep',
      morph: {},
    });
  });

  if (opts.annotationCompleted ?? true) {
    const _run = factories(em).postPipelineRun.makeOne({
      postId: post.id,
      stage: PostPipelineStage.Annotation,
      status: PostPipelineRunStatus.Completed,
    });
  }

  await em.flush();
  return post.id;
}

async function loadParagraph(
  em: EntityManager,
  postId: string,
): Promise<Paragraph> {
  const part = await em.findOneOrFail(
    PostPart,
    { postId, blockIndex: 0 },
    { disableIdentityMap: true },
  );
  return part.body as Paragraph;
}

describe('TagGrammarHandler', () => {
  const fakeAi = new FakeAiClient();
  let grammarResponse = DEFAULT_GRAMMAR_RESPONSE;
  fakeAi.onComplete = () => grammarResponse;
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );
  const queue = useQueueSpy(suite);

  beforeEach(() => {
    grammarResponse = DEFAULT_GRAMMAR_RESPONSE;
  });

  it('writes a grammar_match with the token range and resolved usage point', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new TagGrammarCommand(postId));

    const usagePoint = await suite.orm.em.findOneOrFail(GrammarUsagePoint, {
      egpIndex: 412,
    });
    const matches = await suite.orm.em.find(GrammarMatch, {});
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      grammarUsagePointId: usagePoint.id,
      tokenStart: 1,
      tokenEnd: 4,
    });

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiGrammar,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
    queue.assertSent(
      QueueName.PostAiGrammarEnrichment,
      (data: { postId: string }) => data.postId === postId,
    );
    queue.assertSent(
      QueueName.PostAiExercises,
      (data: { postId: string }) => data.postId === postId,
    );
  });

  it('drops a span whose usage-point index does not belong to the tagged construction', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);
    grammarResponse = `[0] She ⟦had never visited⟧{{g|past-perfect|11111}} Tokyo before.`;

    await suite.command(new TagGrammarCommand(postId));

    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(0);
  });

  it('dedupes an identical span the model repeats instead of failing on the unique constraint', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);
    grammarResponse =
      `[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.\n` +
      `[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.`;

    await suite.command(new TagGrammarCommand(postId));

    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(1);
  });

  it('is idempotent — a second run neither re-calls the AI nor duplicates matches', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new TagGrammarCommand(postId));
    const callsAfterFirstRun = fakeAi.completeCallCount;

    await suite.command(new TagGrammarCommand(postId));

    expect(fakeAi.completeCallCount).toBe(callsAfterFirstRun);
    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(1);
  });

  it('no-ops and re-queues itself while the annotation branch is not Completed', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em, {
      annotationCompleted: false,
    });
    const callsBefore = fakeAi.completeCallCount;

    await suite.command(new TagGrammarCommand(postId));

    expect(fakeAi.completeCallCount).toBe(callsBefore);
    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(0);
    expect(
      await suite.orm.em.findOne(PostPipelineRun, {
        postId,
        stage: PostPipelineStage.AiGrammar,
      }),
    ).toBeNull();
    queue.assertSent<PostAiGrammarJobData>(
      QueueName.PostAiGrammar,
      (data) => data.postId === postId,
    );
    queue.assertNotSent(QueueName.PostAiExercises);
    queue.assertNotSent(QueueName.PostAiGrammarEnrichment);
  });

  it('paints the construction slug onto the post part node tree', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new TagGrammarCommand(postId));

    const paragraph = await loadParagraph(suite.orm.em, postId);
    expect(paragraph.children).toEqual([
      { type: 'text', text: 'She ' },
      {
        type: 'span',
        kind: 'grammar_only',
        text: 'had never visited',
        grammarConstruct: 'past-perfect',
      },
      { type: 'text', text: ' Tokyo before.' },
    ]);
  });

  it('re-paints from scratch on a stage retry (strip + repaint, no stacking)', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new TagGrammarCommand(postId));
    const firstRun = await loadParagraph(suite.orm.em, postId);

    // Simulate a partial stage retry: drop the AiGrammar run row so the
    // handler re-executes instead of short-circuiting.
    await suite.orm.em.nativeDelete(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiGrammar,
    });

    await suite.command(new TagGrammarCommand(postId));
    const secondRun = await loadParagraph(suite.orm.em, postId);

    expect(secondRun).toEqual(firstRun);
    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(1);
  });
});
