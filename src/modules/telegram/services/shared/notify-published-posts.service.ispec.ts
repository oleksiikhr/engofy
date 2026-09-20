import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { factories } from '../../../../../test/factories/factories.js';
import { FakeTelegramClient } from '../../../../../test/fakes/telegram.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import AppConfig from '../../../../core/config/app.config.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import TelegramConfig from '../../config/telegram.config.js';
import { TelegramModule } from '../../telegram.module.js';
import { TelegramClientService } from '../telegram-client.service.js';
import { NotifyPublishedPostsService } from './notify-published-posts.service.js';

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
    publishNotifiedAt?: DateTime | null;
  },
): Promise<Post> {
  const source = { format: PostSourceFormat.Text, rawText: 'body' };
  const post = factories(em).post.makeOne({
    source,
    title: opts.title,
    slug: 'a-slug',
    status: opts.status,
    publishNotifiedAt: opts.publishNotifiedAt ?? null,
  });
  await em.flush();
  return post;
}

describe('NotifyPublishedPostsService', () => {
  const fakeClient = new FakeTelegramClient();
  // Mutated per test — the service holds this exact object.
  const config = { ...FAKE_CONFIG };
  let service: NotifyPublishedPostsService;

  const suite = createIntegrationSuite(
    { imports: [TelegramModule] },
    {
      builderHook: (builder) =>
        builder
          .overrideProvider(TelegramClientService)
          .useValue(fakeClient)
          .overrideProvider(TelegramConfig.KEY)
          .useValue(config)
          .overrideProvider(AppConfig.KEY)
          .useValue({ publicUrl: 'https://engofy.test' }),
    },
  );

  beforeAll(() => {
    service = suite.moduleRef.get(NotifyPublishedPostsService, {
      strict: false,
    });
  });

  beforeEach(() => {
    config.adminUserId = FAKE_CONFIG.adminUserId;
    fakeClient.configured = true;
    fakeClient.sent = [];
    fakeClient.nextError = null;
  });

  it('notifies the admin once with the post link, and stamps the post', async () => {
    const seeded = await seedPost(suite.orm.em, {
      title: 'Fresh Post',
      status: PostStatus.Published,
    });
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    expect(fakeClient.sent).toHaveLength(1);
    expect(fakeClient.sent[0].chatId).toBe('42');
    expect(fakeClient.sent[0].text).toContain('Fresh Post');
    expect(fakeClient.sent[0].text).toContain(
      `https://engofy.test/posts/a-slug-${seeded.shortId}`,
    );
    const post = await suite.orm.em.findOneOrFail(Post, seeded.id);
    expect(post.publishNotifiedAt).toBeTruthy();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
  });

  it('ignores published posts already notified and posts that are not published', async () => {
    await seedPost(suite.orm.em, {
      title: 'Old',
      status: PostStatus.Published,
      publishNotifiedAt: DateTime.now(),
    });
    await seedPost(suite.orm.em, {
      title: 'Busy',
      status: PostStatus.Processing,
    });
    await seedPost(suite.orm.em, {
      title: 'Broken',
      status: PostStatus.Failed,
    });
    suite.orm.em.clear();

    await service.run();

    expect(fakeClient.sent).toEqual([]);
  });

  it('leaves the post unnotified when the send throws, so the next tick retries', async () => {
    const seeded = await seedPost(suite.orm.em, {
      title: 'Fresh Post',
      status: PostStatus.Published,
    });
    suite.orm.em.clear();
    fakeClient.nextError = new Error('bot was blocked by the user');

    await service.run();
    suite.orm.em.clear();

    const post = await suite.orm.em.findOneOrFail(Post, seeded.id);
    expect(post.publishNotifiedAt).toBeNull();

    await service.run();

    expect(fakeClient.sent).toHaveLength(1);
  });

  it('does nothing without a bot token or admin id', async () => {
    await seedPost(suite.orm.em, {
      title: 'Fresh Post',
      status: PostStatus.Published,
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
