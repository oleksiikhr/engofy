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
import { TelegramUpdate } from '../../entities/telegram-update.entity.js';
import { TelegramModule } from '../../telegram.module.js';
import {
  TelegramClientService,
  type TelegramUpdatePayload,
} from '../telegram-client.service.js';
import { PollUpdatesService } from './poll-updates.service.js';

const ADMIN_ID = 42;

const FAKE_CONFIG = {
  botToken: 'test-token',
  adminUserId: String(ADMIN_ID),
  channelId: '@engofy_test',
  apiBaseUrl: 'http://telegram.invalid',
};

function adminMessage(updateId: number, text: string): TelegramUpdatePayload {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      text,
      from: { id: ADMIN_ID },
      chat: { id: ADMIN_ID },
    },
  };
}

describe('PollUpdatesService', () => {
  const fakeClient = new FakeTelegramClient();
  let service: PollUpdatesService;

  const suite = createIntegrationSuite(
    { imports: [TelegramModule] },
    {
      builderHook: (builder) =>
        builder
          .overrideProvider(TelegramClientService)
          .useValue(fakeClient)
          .overrideProvider(TelegramConfig.KEY)
          .useValue(FAKE_CONFIG),
    },
  );

  beforeAll(() => {
    service = suite.moduleRef.get(PollUpdatesService, { strict: false });
  });

  beforeEach(() => {
    fakeClient.queued = [];
    fakeClient.offsets = [];
    fakeClient.sent = [];
    fakeClient.failSendMessage = false;
  });

  it('stores an admin /add update and ingests the pasted text', async () => {
    fakeClient.queued = [adminMessage(100, '/add A short tale about a fox.')];

    await service.run();
    suite.orm.em.clear();

    const stored = await suite.orm.em.find(TelegramUpdate, {});
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      updateId: '100',
      processed: true,
    });

    const posts = await suite.orm.em.find(Post, {});
    expect(posts).toHaveLength(1);
    expect(posts[0].source.rawText).toBe('A short tale about a fox.');
    expect(fakeClient.sent[0].text).toContain('Queued');
    expect(fakeClient.sent[0].text).toContain(`/retry ${posts[0].id}`);
    expect(fakeClient.sent[0].text).toContain(`/status ${posts[0].id}`);
  });

  it('replies to /status with stage progress for a post and for the recent list', async () => {
    const em = suite.orm.em;
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'seed';
    const post = new Post();
    post.source = source;
    post.title = 'Stuck tale';
    post.status = PostStatus.Failed;
    em.persist(post);
    em.create(PostPipelineRun, {
      postId: post.id,
      stage: PostPipelineStage.AiExercises,
      status: PostPipelineRunStatus.Failed,
      errorMessage: 'invalid payload',
    });
    await em.flush();
    em.clear();

    fakeClient.queued = [
      adminMessage(700, `/status ${post.id}`),
      adminMessage(701, '/status'),
      adminMessage(702, '/status 01920000-0000-7000-8000-000000000000'),
    ];
    await service.run();

    expect(fakeClient.sent[0].text).toContain(`id: ${post.id}`);
    expect(fakeClient.sent[0].text).toContain(
      '✗ ai_exercises: invalid payload',
    );
    expect(fakeClient.sent[1].text).toContain(`id: ${post.id}`);
    expect(fakeClient.sent[2].text).toBe(
      'Post 01920000-0000-7000-8000-000000000000 not found.',
    );
  });

  it('derives the next getUpdates offset from the highest stored update id', async () => {
    fakeClient.queued = [adminMessage(100, '/add first')];
    await service.run();

    fakeClient.queued = [];
    await service.run();

    // First poll had nothing stored (offset undefined); second polls from 101.
    expect(fakeClient.offsets).toEqual([undefined, 101]);
  });

  it('stores but ignores a non-admin message', async () => {
    fakeClient.queued = [
      {
        update_id: 200,
        message: {
          message_id: 200,
          text: '/add sneaky',
          from: { id: 999 },
          chat: { id: 999 },
        },
      },
    ];

    await service.run();
    suite.orm.em.clear();

    const row = await suite.orm.em.findOneOrFail(TelegramUpdate, {
      updateId: '200',
    });
    expect(row.processed).toBe(true);
    expect(await suite.orm.em.count(Post, {})).toBe(0);
    expect(fakeClient.sent).toHaveLength(0);
  });

  it('does not act twice on an update that is already stored', async () => {
    fakeClient.queued = [adminMessage(100, '/add duplicate')];

    await service.run();
    // Telegram re-delivers the same update before the offset advances.
    await service.run();
    suite.orm.em.clear();

    expect(await suite.orm.em.count(Post, {})).toBe(1);
  });

  it('replies with an error and still marks the update processed when a command throws', async () => {
    fakeClient.queued = [
      adminMessage(300, '/retry 01920000-0000-7000-8000-000000000000'),
    ];

    await service.run();
    suite.orm.em.clear();

    const row = await suite.orm.em.findOneOrFail(TelegramUpdate, {
      updateId: '300',
    });
    expect(row.processed).toBe(true);
    expect(fakeClient.sent.at(-1)?.text).toContain('failed');
  });

  it('commits the update as processed before dispatch, so a failing command is not retried on re-delivery', async () => {
    fakeClient.queued = [
      adminMessage(400, '/retry 01920000-0000-7000-8000-000000000000'),
    ];

    await service.run();
    // Telegram re-delivers the same update before the offset advances.
    await service.run();
    suite.orm.em.clear();

    // Second run sees the stored row and skips it — only one failure reply.
    expect(
      fakeClient.sent.filter((m) => m.text.includes('failed')),
    ).toHaveLength(1);
  });

  it('does not reply "Command failed" when only the confirmation send throws', async () => {
    fakeClient.queued = [adminMessage(500, '/add A tale that ingests fine.')];
    fakeClient.failSendMessage = true;

    await expect(service.run()).resolves.toBeUndefined();
    suite.orm.em.clear();

    // The command ran (post created) and the row is processed; the failed
    // confirmation is swallowed, not surfaced as a command failure.
    expect(await suite.orm.em.count(Post, {})).toBe(1);
    const row = await suite.orm.em.findOneOrFail(TelegramUpdate, {
      updateId: '500',
    });
    expect(row.processed).toBe(true);
    expect(fakeClient.sent).toHaveLength(0);
  });

  it('no-ops without polling when no admin user id is configured', async () => {
    const original = FAKE_CONFIG.adminUserId;
    FAKE_CONFIG.adminUserId = '';
    try {
      fakeClient.queued = [adminMessage(600, '/add ignored')];

      await service.run();
      suite.orm.em.clear();

      expect(fakeClient.offsets).toHaveLength(0);
      expect(await suite.orm.em.count(TelegramUpdate, {})).toBe(0);
    } finally {
      FAKE_CONFIG.adminUserId = original;
    }
  });
});
