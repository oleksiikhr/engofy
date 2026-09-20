import type { EntityManager } from '@mikro-orm/postgresql';
import { factories } from '../../../../../test/factories/factories.js';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import type { ComplexityAssessment } from '../../domain/complexity-prompt.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostTopic } from '../../enums/post-topic.enum.js';
import { PostModule } from '../../post.module.js';
import { AssessComplexityCommand } from './assess-complexity.command.js';

const SENTENCE_INDEX_RE = /^\[(\d+)]/gm;

// Returns a fixed assessment for the two fixture sentences, echoing back
// whatever indexes it was shown so indexComplexityLevels is satisfied.
function fixtureAssessment(userText: string): ComplexityAssessment {
  const indexes = [...userText.matchAll(SENTENCE_INDEX_RE)].map((m) =>
    Number(m[1]),
  );
  return {
    overall: CefrLevel.B2,
    topic: PostTopic.Food,
    newVocabRatio: 0.15,
    sentences: indexes.map((index) => ({
      index,
      level: index === 0 ? CefrLevel.B1 : CefrLevel.C1,
    })),
  };
}

async function createPostWithSentences(
  em: EntityManager,
  rawTexts: string[],
): Promise<string> {
  const source = { format: PostSourceFormat.Text, rawText: rawTexts.join(' ') };

  const post = factories(em).post.makeOne({
    status: PostStatus.Pending,
    source,
  });

  const postPartId = factories(em).postPart.makeOne({ postId: post.id }).id;
  rawTexts.forEach((rawText, position) => {
    const _sentence = factories(em).sentence.makeOne({
      postId: post.id,
      postPartId,
      unitIndex: 0,
      position,
      rawText,
      charStart: 0,
      charEnd: rawText.length,
    });
  });

  await em.flush();
  return post.id;
}

describe('AssessComplexityHandler', () => {
  const fakeAi = new FakeAiClient();
  fakeAi.onCompleteStructured = ({ userText }) => fixtureAssessment(userText);
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  it('sets the post CEFR level, each sentence level, and completes the run', async () => {
    const postId = await createPostWithSentences(suite.orm.em, [
      'The cat sat on the mat.',
      'Notwithstanding the aforementioned caveats, the thesis remains tenuous.',
    ]);

    await suite.command(new AssessComplexityCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.cefrLevel).toBe(CefrLevel.B2);
    expect(post.topic).toBe(PostTopic.Food);

    const sentences = await suite.orm.em.find(
      Sentence,
      { postId },
      { orderBy: { position: 'asc' } },
    );
    expect(sentences.map((s) => s.cefrLevel)).toEqual([
      CefrLevel.B1,
      CefrLevel.C1,
    ]);

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiComplexity,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('is idempotent — a second run does not call the AI again', async () => {
    const postId = await createPostWithSentences(suite.orm.em, [
      'One sentence here.',
      'Another sentence here.',
    ]);

    await suite.command(new AssessComplexityCommand(postId));
    const callsAfterFirstRun = fakeAi.structuredCallCount;

    await suite.command(new AssessComplexityCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(callsAfterFirstRun);
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
      suite.command(new AssessComplexityCommand(postId)),
    ).rejects.toThrow('no sentences');
  });
});
