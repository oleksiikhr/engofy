import * as Sentry from '@sentry/nestjs';
import { v7 as uuidv7 } from 'uuid';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { AiSchemaMismatchError } from '../../../core/ai/ai-schema-mismatch.error.js';
import { PostSource } from '../../../modules/post/embeddables/post-source.embeddable.js';
import { Post } from '../../../modules/post/entities/post.entity.js';
import { PostPipelineRun } from '../../../modules/post/entities/post-pipeline-run.entity.js';
import { PostPipelineRunStatus } from '../../../modules/post/enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../../modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../modules/post/enums/post-status.enum.js';
import { JobWorkerHost, type PipelineStageRef } from '../job-worker-host.js';
import { TagGrammarModule } from './tag-grammar.module.js';
import { TagGrammarProcessor } from './tag-grammar.processor.js';

vi.mock('@sentry/nestjs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/nestjs')>()),
  captureException: vi.fn(),
}));

class ThrowingProcessor extends JobWorkerHost<{ postId: string }> {
  constructor(private readonly error: Error) {
    super();
  }

  protected pipelineStage(job: { data: { postId: string } }): PipelineStageRef {
    return { stage: PostPipelineStage.AiExercises, postId: job.data.postId };
  }

  protected async processJob(): Promise<void> {
    throw this.error;
  }
}

// `JobWorkerHost` maintains the `post_pipeline_runs` row around a pipeline job
// on its own transaction, so a failed stage always leaves a trace even though
// the job's own unit of work rolled back (D4). Driven here through the
// ai_grammar processor.
//
// The bookkeeping writes commit on a forked EntityManager (a real, separate
// transaction — that is the point), so they survive the per-test rollback and
// this suite cleans them up by postId itself.
function fakeJob(
  postId: string,
  meta: { retryCount: number; retryLimit: number },
) {
  return {
    id: uuidv7(),
    name: 'post-ai-grammar',
    data: { postId },
    retryCount: meta.retryCount,
    retryLimit: meta.retryLimit,
    // biome-ignore lint/suspicious/noExplicitAny: minimal JobWithMetadata stub for the host.
  } as any;
}

describe('JobWorkerHost pipeline-run tracking (D4)', () => {
  const suite = createIntegrationSuite({ imports: [TagGrammarModule] });
  const seededPostIds: string[] = [];

  let processor: TagGrammarProcessor;

  beforeAll(() => {
    processor = suite.moduleRef.get(TagGrammarProcessor);
  });

  afterEach(async () => {
    if (seededPostIds.length === 0) {
      return;
    }
    const em = suite.orm.em.fork();
    await em.nativeDelete(PostPipelineRun, { postId: { $in: seededPostIds } });
    await em.nativeDelete(Post, { id: { $in: seededPostIds } });
    seededPostIds.length = 0;
  });

  async function seedPost(): Promise<string> {
    const em = suite.orm.em.fork();
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'x';
    const post = new Post();
    post.source = source;
    post.status = PostStatus.Pending;
    em.persist(post);

    // The ai_grammar stage gates on a Completed annotation run before it does
    // any work; seed one so the job reaches the "no sentences" throw this suite
    // uses to drive the D4 failure bookkeeping.
    const annotationRun = new PostPipelineRun();
    annotationRun.postId = post.id;
    annotationRun.stage = PostPipelineStage.Annotation;
    annotationRun.status = PostPipelineRunStatus.Completed;
    em.persist(annotationRun);

    await em.flush();
    seededPostIds.push(post.id);
    return post.id;
  }

  function readRun(postId: string): Promise<PostPipelineRun | null> {
    return suite.orm.em
      .fork()
      .findOne(PostPipelineRun, { postId, stage: PostPipelineStage.AiGrammar });
  }

  it('records a Failed run row with the error message when the stage throws', async () => {
    // No sentences seeded -> the handler throws "needs spacy_parse output".
    const postId = await seedPost();

    await expect(
      processor.work([fakeJob(postId, { retryCount: 0, retryLimit: 3 })]),
    ).rejects.toThrow();

    const run = await readRun(postId);
    expect(run).not.toBeNull();
    expect(run?.status).toBe(PostPipelineRunStatus.Failed);
    expect(run?.startedAt).toBeTruthy();
    expect(run?.errorMessage).toContain('needs spacy_parse output');
    expect(run?.retryCount).toBe(1);
  });

  it('leaves the post untouched while pg-boss still has retries left', async () => {
    const postId = await seedPost();

    await expect(
      processor.work([fakeJob(postId, { retryCount: 1, retryLimit: 3 })]),
    ).rejects.toThrow();

    const post = await suite.orm.em.fork().findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Pending);
  });

  it('flips the post to Failed once pg-boss retries are exhausted', async () => {
    const postId = await seedPost();

    await expect(
      processor.work([fakeJob(postId, { retryCount: 3, retryLimit: 3 })]),
    ).rejects.toThrow();

    const post = await suite.orm.em.fork().findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Failed);

    const run = await readRun(postId);
    expect(run?.retryCount).toBe(4);
  });

  describe('Sentry capture', () => {
    beforeEach(() => {
      vi.mocked(Sentry.captureException).mockClear();
    });

    function throwingProcessor(error: Error) {
      return injectOrm(new ThrowingProcessor(error), suite.orm);
    }

    it('tags the failure with postId and stage, flagging the last attempt', async () => {
      const postId = await seedPost();
      const error = new Error('boom');

      await expect(
        throwingProcessor(error).work([
          fakeJob(postId, { retryCount: 3, retryLimit: 3 }),
        ]),
      ).rejects.toThrow('boom');

      expect(Sentry.captureException).toHaveBeenCalledExactlyOnceWith(error, {
        tags: {
          postId,
          stage: PostPipelineStage.AiExercises,
          exhausted: 'true',
        },
      });
    });

    it('flags an attempt with retries left as not exhausted', async () => {
      const postId = await seedPost();

      await expect(
        throwingProcessor(new Error('boom')).work([
          fakeJob(postId, { retryCount: 0, retryLimit: 3 }),
        ]),
      ).rejects.toThrow();

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ exhausted: 'false' }),
        }),
      );
    });

    it('groups an AI schema mismatch under its own fingerprint per tool and stage', async () => {
      const postId = await seedPost();
      const error = new AiSchemaMismatchError('report_grammar_contrastive');

      await expect(
        throwingProcessor(error).work([
          fakeJob(postId, { retryCount: 3, retryLimit: 3 }),
        ]),
      ).rejects.toThrow(AiSchemaMismatchError);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          fingerprint: [
            'ai-schema-mismatch',
            'report_grammar_contrastive',
            PostPipelineStage.AiExercises,
          ],
        }),
      );
    });

    it('leaves other errors on the default fingerprint', async () => {
      const postId = await seedPost();

      await expect(
        throwingProcessor(new Error('boom')).work([
          fakeJob(postId, { retryCount: 0, retryLimit: 3 }),
        ]),
      ).rejects.toThrow();

      const [, context] = vi.mocked(Sentry.captureException).mock.calls[0];
      expect(context).not.toHaveProperty('fingerprint');
    });
  });
});
