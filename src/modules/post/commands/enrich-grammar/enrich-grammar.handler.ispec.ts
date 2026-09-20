import type { EntityManager } from '@mikro-orm/postgresql';
import { factories } from '../../../../../test/factories/factories.js';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import { AiSchemaMismatchError } from '../../../../core/ai/ai-schema-mismatch.error.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { EnrichGrammarCommand } from './enrich-grammar.command.js';

const RESULT = {
  explanation: 'We use it to talk about routines.',
  translatedExplanation: 'Ми вживаємо це, щоб говорити про рутину.',
  example1: 'I get up at seven.',
  example2: 'She works in a shop.',
};

interface Fixture {
  postId: string;
  matchedPointId: string;
  otherPointId: string;
}

// One post with one sentence matched to one usage point; a second usage point
// of the same construction is not matched and must stay untouched.
async function seedPost(
  em: EntityManager,
  matchedOverrides: Partial<GrammarUsagePoint> = {},
): Promise<Fixture> {
  const category = factories(em).grammarCategory.makeOne();
  const construction = factories(em).grammarConstruction.makeOne({
    categoryId: category.id,
    cheatSheetContent: '## Form\nSubject + base verb',
  });
  const matched = factories(em).grammarUsagePoint.makeOne({
    constructionId: construction.id,
    cefrLevel: CefrLevel.A1,
    ...matchedOverrides,
  });
  const other = factories(em).grammarUsagePoint.makeOne({
    constructionId: construction.id,
  });

  const post = factories(em).post.makeOne({
    status: PostStatus.Pending,
    source: { format: PostSourceFormat.Text, rawText: 'I walk to work.' },
  });
  const part = factories(em).postPart.makeOne({ postId: post.id });
  const sentence = factories(em).sentence.makeOne({
    postId: post.id,
    postPartId: part.id,
  });
  factories(em).grammarMatch.makeOne({
    sentenceId: sentence.id,
    grammarUsagePointId: matched.id,
  });

  await em.flush();
  return {
    postId: post.id,
    matchedPointId: matched.id,
    otherPointId: other.id,
  };
}

describe('EnrichGrammarHandler', () => {
  const fakeAi = new FakeAiClient();
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  beforeEach(() => {
    fakeAi.structuredCallCount = 0;
    fakeAi.onCompleteStructured = () => RESULT;
  });

  it('fills the matched usage point and completes the run', async () => {
    const { postId, matchedPointId, otherPointId } = await seedPost(
      suite.orm.em,
    );

    await suite.command(new EnrichGrammarCommand(postId));

    const matched = await suite.orm.em.findOneOrFail(
      GrammarUsagePoint,
      matchedPointId,
    );
    expect(matched.learnerExplanation).toBe(RESULT.explanation);
    expect(matched.translations).toEqual({
      uk: { explanation: RESULT.translatedExplanation },
    });
    expect(matched.learnerExamples).toEqual([RESULT.example1, RESULT.example2]);

    const other = await suite.orm.em.findOneOrFail(
      GrammarUsagePoint,
      otherPointId,
    );
    expect(other.learnerExplanation).toBeNull();
    expect(fakeAi.structuredCallCount).toBe(1);

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.GrammarEnrichment,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('sends the construction, level and can-do statement to the model', async () => {
    const { postId } = await seedPost(suite.orm.em, {
      guideword: 'USE: HABITS',
      canDoStatement: 'Can talk about habits.',
    });
    let userText = '';
    fakeAi.onCompleteStructured = (params) => {
      userText = params.userText as string;
      return RESULT;
    };

    await suite.command(new EnrichGrammarCommand(postId));

    expect(userText).toContain('Level: A1');
    expect(userText).toContain('Usage point: USE: HABITS');
    expect(userText).toContain('Can-do statement: Can talk about habits.');
    expect(userText).toContain('Subject + base verb');
  });

  it('is idempotent — a second run does not call the AI again', async () => {
    const { postId } = await seedPost(suite.orm.em);

    await suite.command(new EnrichGrammarCommand(postId));
    await suite.command(new EnrichGrammarCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(1);
  });

  it('skips the AI call when the matched point is already enriched', async () => {
    const { postId } = await seedPost(suite.orm.em, {
      learnerExplanation: 'Already written.',
      translations: { uk: { explanation: 'Уже написано.' } },
      learnerExamples: ['Already an example.'],
    });

    await suite.command(new EnrichGrammarCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(0);
    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.GrammarEnrichment,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('retries a malformed payload once, then leaves the point un-enriched', async () => {
    const { postId, matchedPointId } = await seedPost(suite.orm.em);
    fakeAi.onCompleteStructured = () => {
      throw new AiSchemaMismatchError('report_grammar_enrichment');
    };

    await suite.command(new EnrichGrammarCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(2);
    const matched = await suite.orm.em.findOneOrFail(
      GrammarUsagePoint,
      matchedPointId,
    );
    expect(matched.learnerExplanation).toBeNull();
    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.GrammarEnrichment,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });
});
