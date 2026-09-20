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
import { NotifyStuckPostsService } from './notify-stuck-posts.service.js';

const FAKE_CONFIG = {
  botToken: 'test-token',
  adminUserId: '42',
  channelId: '@engofy_test',
  apiBaseUrl: 'http://telegram.invalid',
  stuckPostMinutes: 15,
};

const minutesAgo = (minutes: number) => DateTime.now().minus({ minutes });

// `createdAt` / run `updatedAt` are set explicitly (and flushed) — `onCreate` /
// `onUpdate` only fill them when unset.
async function seedPost(
  em: EntityManager,
  opts: {
    title: string;
    status?: PostStatus;
    createdMinutesAgo?: number;
    stuckNotifiedAt?: DateTime | null;
    runs?: {
      stage: PostPipelineStage;
      status: PostPipelineRunStatus;
      updatedMinutesAgo: number;
    }[];
  },
): Promise<Post> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'body';
  const post = new Post();
  post.source = source;
  post.title = opts.title;
  post.status = opts.status ?? PostStatus.Processing;
  post.createdAt = minutesAgo(opts.createdMinutesAgo ?? 60);
  post.stuckNotifiedAt = opts.stuckNotifiedAt ?? null;
  em.persist(post);
  for (const spec of opts.runs ?? []) {
    const run = new PostPipelineRun();
    run.postId = post.id;
    run.stage = spec.stage;
    run.status = spec.status;
    run.updatedAt = minutesAgo(spec.updatedMinutesAgo);
    em.persist(run);
  }
  await em.flush();
  return post;
}

describe('NotifyStuckPostsService', () => {
  const fakeClient = new FakeTelegramClient();
  // Mutated per test — the service holds this exact object.
  const config = { ...FAKE_CONFIG };
  let service: NotifyStuckPostsService;

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
    service = suite.moduleRef.get(NotifyStuckPostsService, { strict: false });
  });

  beforeEach(() => {
    config.adminUserId = FAKE_CONFIG.adminUserId;
    config.stuckPostMinutes = FAKE_CONFIG.stuckPostMinutes;
    fakeClient.configured = true;
    fakeClient.sent = [];
    fakeClient.nextError = null;
  });

  it('alerts once for a processing post idle past the cutoff, and stamps it', async () => {
    const seeded = await seedPost(suite.orm.em, {
      title: 'Stalled',
      runs: [
        {
          stage: PostPipelineStage.SpacyParse,
          status: PostPipelineRunStatus.Completed,
          updatedMinutesAgo: 30,
        },
        {
          stage: PostPipelineStage.AiExercises,
          status: PostPipelineRunStatus.Pending,
          updatedMinutesAgo: 20,
        },
      ],
    });
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    expect(fakeClient.sent).toHaveLength(1);
    expect(fakeClient.sent[0].chatId).toBe('42');
    expect(fakeClient.sent[0].text).toContain('Post stuck: Stalled');
    expect(fakeClient.sent[0].text).toContain(`id: ${seeded.id}`);
    expect(fakeClient.sent[0].text).toContain('stage: ai_exercises');
    expect(fakeClient.sent[0].text).toContain('idle: 20 min');
    const post = await suite.orm.em.findOneOrFail(Post, seeded.id);
    expect(post.stuckNotifiedAt).toBeTruthy();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
  });

  it('measures idle time from the newest run, not the post age', async () => {
    await seedPost(suite.orm.em, {
      title: 'Moving',
      runs: [
        {
          stage: PostPipelineStage.SpacyParse,
          status: PostPipelineRunStatus.Completed,
          updatedMinutesAgo: 60,
        },
        {
          stage: PostPipelineStage.Annotation,
          status: PostPipelineRunStatus.Pending,
          updatedMinutesAgo: 2,
        },
      ],
    });
    suite.orm.em.clear();

    await service.run();

    expect(fakeClient.sent).toEqual([]);
  });

  it('falls back to the post age when there are no runs', async () => {
    await seedPost(suite.orm.em, { title: 'Never started' });
    await seedPost(suite.orm.em, {
      title: 'Just created',
      createdMinutesAgo: 1,
    });
    suite.orm.em.clear();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
    expect(fakeClient.sent[0].text).toContain('Post stuck: Never started');
  });

  it('honours the configured threshold', async () => {
    await seedPost(suite.orm.em, {
      title: 'Slowish',
      createdMinutesAgo: 20,
    });
    suite.orm.em.clear();
    config.stuckPostMinutes = 30;

    await service.run();

    expect(fakeClient.sent).toEqual([]);
  });

  it('ignores posts that are not processing', async () => {
    await seedPost(suite.orm.em, {
      title: 'Waiting',
      status: PostStatus.Pending,
    });
    await seedPost(suite.orm.em, {
      title: 'Done',
      status: PostStatus.Published,
    });
    await seedPost(suite.orm.em, {
      title: 'Broken',
      status: PostStatus.Failed,
    });
    suite.orm.em.clear();

    await service.run();

    expect(fakeClient.sent).toEqual([]);
  });

  it('re-alerts only after new activity goes idle again', async () => {
    const seeded = await seedPost(suite.orm.em, {
      title: 'Twice stuck',
      stuckNotifiedAt: minutesAgo(30),
      runs: [
        {
          stage: PostPipelineStage.SpacyParse,
          status: PostPipelineRunStatus.Completed,
          updatedMinutesAgo: 45,
        },
      ],
    });
    suite.orm.em.clear();

    await service.run();
    expect(fakeClient.sent).toEqual([]);

    // Native update: an entity flush would re-stamp `updatedAt` via `onUpdate`.
    await suite.orm.em.nativeUpdate(
      PostPipelineRun,
      { postId: seeded.id },
      { updatedAt: minutesAgo(20) },
    );
    suite.orm.em.clear();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
  });

  it('leaves the post unstamped when the send throws, so the next tick retries', async () => {
    const seeded = await seedPost(suite.orm.em, { title: 'Stalled' });
    suite.orm.em.clear();
    fakeClient.nextError = new Error('bot was blocked by the user');

    await service.run();
    suite.orm.em.clear();

    const post = await suite.orm.em.findOneOrFail(Post, seeded.id);
    expect(post.stuckNotifiedAt).toBeNull();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
  });

  it('does nothing without a bot token or admin id', async () => {
    await seedPost(suite.orm.em, { title: 'Stalled' });
    suite.orm.em.clear();

    fakeClient.configured = false;
    await service.run();
    fakeClient.configured = true;
    config.adminUserId = '';
    await service.run();

    expect(fakeClient.sent).toEqual([]);
  });
});
