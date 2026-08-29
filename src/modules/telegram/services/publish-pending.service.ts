import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import AppConfig from '../../../core/config/app.config.js';
import { Post } from '../../post/entities/post.entity.js';
import { PostPublication } from '../../post/entities/post-publication.entity.js';
import { PublicationPlatform } from '../../post/enums/publication-platform.enum.js';
import { PublicationStatus } from '../../post/enums/publication-status.enum.js';
import TelegramConfig from '../config/telegram.config.js';
import { formatPostAnnouncement } from '../domain/format-announcement.js';
import { TelegramClientService } from './telegram-client.service.js';

const BATCH_SIZE = 10;

// The telegram side of post_publications (PLAN.md §3.8, the only channel in
// V1). The publish stage creates a `pending` row; this cron drains them:
// send the announcement to the configured channel, then mark the row
// `published` with the returned message id, or `failed` with the error. One
// flush per row so a mid-batch failure keeps the rows already sent.
@Injectable()
export class PublishPendingService {
  private readonly logger = new Logger(PublishPendingService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly client: TelegramClientService,
    @Inject(TelegramConfig.KEY)
    private readonly config: ConfigType<typeof TelegramConfig>,
    @Inject(AppConfig.KEY)
    private readonly appConfig: ConfigType<typeof AppConfig>,
  ) {}

  async run(): Promise<void> {
    if (!this.client.configured || this.config.channelId === '') {
      return;
    }

    const pending = await this.em.find(
      PostPublication,
      {
        platform: PublicationPlatform.Telegram,
        status: PublicationStatus.Pending,
      },
      { orderBy: { createdAt: 'asc' }, limit: BATCH_SIZE },
    );

    for (const publication of pending) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one send + one flush per row so a failure mid-batch keeps the rows already published.
      await this.publishOne(publication);
      await this.em.flush();
    }
  }

  private async publishOne(publication: PostPublication): Promise<void> {
    try {
      const post = await this.em.findOneOrFail(Post, publication.postId);
      const text = formatPostAnnouncement(post, this.appConfig.publicUrl ?? '');
      const sent = await this.client.sendMessage(this.config.channelId, text);

      publication.status = PublicationStatus.Published;
      publication.externalId = String(sent.message_id);
      publication.publishedAt = DateTime.now();
      publication.errorMessage = null;
      this.logger.log(
        { postId: publication.postId, messageId: sent.message_id },
        'post announced on telegram',
      );
    } catch (err) {
      publication.status = PublicationStatus.Failed;
      publication.errorMessage =
        err instanceof Error ? err.message : String(err);
      this.logger.error(
        { err, postId: publication.postId },
        'telegram publication failed',
      );
    }
  }
}
