import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { FakeTelegramClient } from '../../../../../test/fakes/telegram.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostPublication } from '../../../post/entities/post-publication.entity.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { PublicationPlatform } from '../../../post/enums/publication-platform.enum.js';
import { PublicationStatus } from '../../../post/enums/publication-status.enum.js';
import TelegramConfig from '../../config/telegram.config.js';
import { TelegramModule } from '../../telegram.module.js';
import { TelegramClientService } from '../telegram-client.service.js';
import { PublishPendingService } from './publish-pending.service.js';

const FAKE_CONFIG = {
  botToken: 'test-token',
  adminUserId: '42',
  channelId: '@engofy_test',
  apiBaseUrl: 'http://telegram.invalid',
};

async function seedPendingPublication(
  em: EntityManager,
  title: string,
): Promise<string> {
  return seedPublication(em, { title });
}

// Seeds a post + one telegram publication row. `status` / `retryCount` /
// `updatedMinutesAgo` are forced with a raw UPDATE so the entity's onCreate /
// onUpdate hooks don't stamp `updated_at` back to now().
async function seedPublication(
  em: EntityManager,
  opts: {
    title: string;
    status?: PublicationStatus;
    retryCount?: number;
    updatedMinutesAgo?: number;
  },
): Promise<string> {
  const {
    title,
    status = PublicationStatus.Pending,
    retryCount = 0,
    updatedMinutesAgo = 0,
  } = opts;

  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'body';
  const post = new Post();
  post.source = source;
  post.title = title;
  post.slug = 'a-slug';
  em.persist(post);

  const publication = new PostPublication();
  publication.postId = post.id;
  publication.platform = PublicationPlatform.Telegram;
  publication.status = PublicationStatus.Pending;
  em.persist(publication);
  await em.flush();

  await em
    .getConnection()
    .execute(
      'update post_publications set status = ?, retry_count = ?, updated_at = ? where id = ?',
      [
        status,
        retryCount,
        DateTime.now().minus({ minutes: updatedMinutesAgo }).toJSDate(),
        publication.id,
      ],
      'run',
      em.getTransactionContext(),
    );

  return publication.id;
}

describe('PublishPendingService', () => {
  const fakeClient = new FakeTelegramClient();
  fakeClient.nextMessageId = 555;
  let service: PublishPendingService;

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
    service = suite.moduleRef.get(PublishPendingService, { strict: false });
  });

  beforeEach(() => {
    fakeClient.sent = [];
    fakeClient.nextError = null;
  });

  it('sends the announcement and marks the row published with the message id', async () => {
    const publicationId = await seedPendingPublication(
      suite.orm.em,
      'Published Post',
    );
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    const publication = await suite.orm.em.findOneOrFail(
      PostPublication,
      publicationId,
    );
    expect(publication.status).toBe(PublicationStatus.Published);
    expect(publication.externalId).toBe('555');
    expect(publication.publishedAt).toBeTruthy();
    expect(fakeClient.sent[0]).toMatchObject({ chatId: '@engofy_test' });
    expect(fakeClient.sent[0].text).toContain('Published Post');
  });

  it('marks the row failed with the error message when the send throws', async () => {
    const publicationId = await seedPendingPublication(
      suite.orm.em,
      'Doomed Post',
    );
    suite.orm.em.clear();
    fakeClient.nextError = new Error('chat not found');

    await service.run();
    suite.orm.em.clear();

    const publication = await suite.orm.em.findOneOrFail(
      PostPublication,
      publicationId,
    );
    expect(publication.status).toBe(PublicationStatus.Failed);
    expect(publication.errorMessage).toContain('chat not found');
    expect(publication.retryCount).toBe(1);
  });

  it('leaves nothing to do once all rows are resolved', async () => {
    await service.run();
    expect(fakeClient.sent).toHaveLength(0);
  });

  it('re-selects a failed row once the backoff has elapsed and publishes it', async () => {
    const publicationId = await seedPublication(suite.orm.em, {
      title: 'Recovered Post',
      status: PublicationStatus.Failed,
      retryCount: 2,
      updatedMinutesAgo: 10,
    });
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    const publication = await suite.orm.em.findOneOrFail(
      PostPublication,
      publicationId,
    );
    expect(publication.status).toBe(PublicationStatus.Published);
    expect(fakeClient.sent[0].text).toContain('Recovered Post');
  });

  it('leaves a freshly failed row alone until the backoff elapses', async () => {
    await seedPublication(suite.orm.em, {
      title: 'Too Soon Post',
      status: PublicationStatus.Failed,
      retryCount: 1,
      updatedMinutesAgo: 1,
    });
    suite.orm.em.clear();

    await service.run();

    expect(fakeClient.sent).toHaveLength(0);
  });

  it('stops retrying a failed row once it reaches the attempt limit', async () => {
    const publicationId = await seedPublication(suite.orm.em, {
      title: 'Given Up Post',
      status: PublicationStatus.Failed,
      retryCount: 5,
      updatedMinutesAgo: 60,
    });
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    expect(fakeClient.sent).toHaveLength(0);
    const publication = await suite.orm.em.findOneOrFail(
      PostPublication,
      publicationId,
    );
    expect(publication.status).toBe(PublicationStatus.Failed);
  });
});
