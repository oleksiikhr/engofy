import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../post/embeddables/post-source.embeddable.js';
import { Post } from '../../post/entities/post.entity.js';
import { PostPublication } from '../../post/entities/post-publication.entity.js';
import { PostSourceFormat } from '../../post/enums/post-source-format.enum.js';
import { PublicationPlatform } from '../../post/enums/publication-platform.enum.js';
import { PublicationStatus } from '../../post/enums/publication-status.enum.js';
import TelegramConfig from '../config/telegram.config.js';
import { TelegramModule } from '../telegram.module.js';
import { PublishPendingService } from './publish-pending.service.js';
import { TelegramClientService } from './telegram-client.service.js';

const FAKE_CONFIG = {
  botToken: 'test-token',
  adminUserId: '42',
  channelId: '@engofy_test',
  apiBaseUrl: 'http://telegram.invalid',
};

class FakeTelegramClient {
  configured = true;
  sent: { chatId: string; text: string }[] = [];
  nextError: Error | null = null;
  nextMessageId = 555;

  async getUpdates(): Promise<[]> {
    return [];
  }

  async sendMessage(
    chatId: string,
    text: string,
  ): Promise<{ message_id: number }> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    this.sent.push({ chatId, text });
    return { message_id: this.nextMessageId };
  }
}

async function seedPendingPublication(
  em: EntityManager,
  title: string,
): Promise<string> {
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
  return publication.id;
}

describe('PublishPendingService', () => {
  const fakeClient = new FakeTelegramClient();
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
  });

  it('leaves nothing to do once all rows are resolved', async () => {
    await service.run();
    expect(fakeClient.sent).toHaveLength(0);
  });
});
