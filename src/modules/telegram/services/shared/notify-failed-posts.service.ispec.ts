import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { FakeTelegramClient } from '../../../../../test/fakes/telegram.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostPipelineRun } from '../../../post/entities/post-pipeline-run.entity.js';
import { PostPipelineRunStatus } from '../../../post/enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../../post/enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import TelegramConfig from '../../config/telegram.config.js';
import { TelegramModule } from '../../telegram.module.js';
import { TelegramClientService } from '../telegram-client.service.js';
import { NotifyFailedPostsService } from './notify-failed-posts.service.js';

const FAKE_CONFIG = {
  botToken: 'test-token',
  adminUserId: '42',
  channelId: '@engofy_test',
  apiBaseUrl: 'http://telegram.invalid',
};

async function seedPost(
  em: EntityManager,
  opts: {
    title: string;
    status: PostStatus;
    failureNotifiedAt?: DateTime | null;
    failedStage?: PostPipelineStage;
  },
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'body';
  const post = new Post();
  post.source = source;
  post.title = opts.title;
  post.status = opts.status;
  post.failureNotifiedAt = opts.failureNotifiedAt ?? null;
  em.persist(post);

  if (opts.failedStage) {
    const run = new PostPipelineRun();
    run.postId = post.id;
    run.stage = opts.failedStage;
    run.status = PostPipelineRunStatus.Failed;
    run.errorMessage = 'model returned an invalid payload';
    run.retryCount = 3;
    em.persist(run);
  }

  await em.flush();
  return post.id;
}

describe('NotifyFailedPostsService', () => {
  const fakeClient = new FakeTelegramClient();
  // Mutated per test — the service holds this exact object.
  const config = { ...FAKE_CONFIG };
  let service: NotifyFailedPostsService;

  const suite = createIntegrationSuite(
    { imports: [TelegramModule] },
    {
      builderHook: (builder) =>
        builder
          .overrideProvider(TelegramClientService)
          .useValue(fakeClient)
          .overrideProvider(TelegramConfig.KEY)
          .useValue(config),
    },
  );

  beforeAll(() => {
    service = suite.moduleRef.get(NotifyFailedPostsService, { strict: false });
  });

  beforeEach(() => {
    config.adminUserId = FAKE_CONFIG.adminUserId;
    fakeClient.configured = true;
    fakeClient.sent = [];
    fakeClient.nextError = null;
  });

  it('alerts the admin once with the failed stage, error and retry line, and stamps the post', async () => {
    const postId = await seedPost(suite.orm.em, {
      title: 'Doomed Post',
      status: PostStatus.Failed,
      failedStage: PostPipelineStage.AiExercises,
    });
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    expect(fakeClient.sent).toHaveLength(1);
    expect(fakeClient.sent[0].chatId).toBe('42');
    expect(fakeClient.sent[0].text).toContain('Doomed Post');
    expect(fakeClient.sent[0].text).toContain('stage: ai_exercises');
    expect(fakeClient.sent[0].text).toContain(
      'error: model returned an invalid payload',
    );
    expect(fakeClient.sent[0].text).toContain(`Re-run: /retry ${postId}`);
    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.failureNotifiedAt).toBeTruthy();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
  });

  it('ignores failed posts already notified and posts that are not failed', async () => {
    await seedPost(suite.orm.em, {
      title: 'Old',
      status: PostStatus.Failed,
      failureNotifiedAt: DateTime.now(),
    });
    await seedPost(suite.orm.em, {
      title: 'Busy',
      status: PostStatus.Processing,
    });
    suite.orm.em.clear();

    await service.run();

    expect(fakeClient.sent).toEqual([]);
  });

  it('leaves the post unnotified when the send throws, so the next tick retries', async () => {
    const postId = await seedPost(suite.orm.em, {
      title: 'Doomed Post',
      status: PostStatus.Failed,
      failedStage: PostPipelineStage.Publish,
    });
    suite.orm.em.clear();
    fakeClient.nextError = new Error('bot was blocked by the user');

    await service.run();
    suite.orm.em.clear();

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.failureNotifiedAt).toBeNull();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
  });

  it('does nothing without a bot token or admin id', async () => {
    await seedPost(suite.orm.em, {
      title: 'Doomed Post',
      status: PostStatus.Failed,
    });
    suite.orm.em.clear();

    fakeClient.configured = false;
    await service.run();
    fakeClient.configured = true;
    config.adminUserId = '';
    await service.run();

    expect(fakeClient.sent).toEqual([]);
  });
});
