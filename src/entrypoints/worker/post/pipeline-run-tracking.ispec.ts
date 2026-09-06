import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../../modules/post/embeddables/post-source.embeddable.js';
import { Post } from '../../../modules/post/entities/post.entity.js';
import { PostPipelineRun } from '../../../modules/post/entities/post-pipeline-run.entity.js';
import { PostPipelineRunStatus } from '../../../modules/post/enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../../modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../modules/post/enums/post-status.enum.js';
import { TagGrammarModule } from './tag-grammar.module.js';
import { TagGrammarProcessor } from './tag-grammar.processor.js';

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
});
