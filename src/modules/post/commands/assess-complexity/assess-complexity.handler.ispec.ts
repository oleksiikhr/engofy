import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import {
  AI_CLIENT,
  type AiClient,
  type AiCompleteStructuredParams,
} from '../../../../core/ai/ai-client.port.js';
import type { ComplexityAssessment } from '../../domain/complexity-prompt.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostModule } from '../../post.module.js';
import { AssessComplexityCommand } from './assess-complexity.command.js';

const SENTENCE_INDEX_RE = /^\[(\d+)]/gm;

// Returns a fixed assessment for the two fixture sentences, echoing back
// whatever indexes it was shown so indexComplexityLevels is satisfied.
class FakeAiClient implements AiClient {
  structuredCallCount = 0;

  complete(): Promise<string> {
    throw new Error('complete not used by AssessComplexityHandler');
  }

  async completeStructured<T>(
    params: AiCompleteStructuredParams<T>,
  ): Promise<T> {
    this.structuredCallCount += 1;
    const indexes = [...params.userText.matchAll(SENTENCE_INDEX_RE)].map((m) =>
      Number(m[1]),
    );
    const assessment: ComplexityAssessment = {
      overall: CefrLevel.B2,
      newVocabRatio: 0.15,
      sentences: indexes.map((index) => ({
        index,
        level: index === 0 ? CefrLevel.B1 : CefrLevel.C1,
      })),
    };
    return assessment as T;
  }
}

async function createPostWithSentences(
  em: EntityManager,
  rawTexts: string[],
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = rawTexts.join(' ');

  const post = new Post();
  post.source = source;
  em.persist(post);

  const postPartId = uuidv7();
  rawTexts.forEach((rawText, position) => {
    const sentence = new Sentence();
    sentence.postId = post.id;
    sentence.postPartId = postPartId;
    sentence.unitIndex = 0;
    sentence.position = position;
    sentence.rawText = rawText;
    sentence.charStart = 0;
    sentence.charEnd = rawText.length;
    em.persist(sentence);
  });

  await em.flush();
  return post.id;
}

describe('AssessComplexityHandler', () => {
  const fakeAi = new FakeAiClient();
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
      suite.command(new AssessComplexityCommand(postId)),
    ).rejects.toThrow('no sentences');
  });
});
