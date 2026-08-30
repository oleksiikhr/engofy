import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import AppConfig from '../../../../core/config/app.config.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostPublication } from '../../../post/entities/post-publication.entity.js';
import { PublicationPlatform } from '../../../post/enums/publication-platform.enum.js';
import { PublicationStatus } from '../../../post/enums/publication-status.enum.js';
import TelegramConfig from '../../config/telegram.config.js';
import { formatPostAnnouncement } from '../../domain/format-announcement.js';
import { TelegramClientService } from '../telegram-client.service.js';

const BATCH_SIZE = 10;

// A `failed` row is retried until it hits this many attempts, then it's left
// terminal (a human notices via the error_message). Telegram outages are
// usually short, so a handful of spaced retries recovers the announcement
// without an unbounded loop (D15 #30).
const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MINUTES = 5;

// The telegram side of post_publications (PLAN.md §3.8, the only channel in
// V1). The publish stage creates a `pending` row; this cron drains them:
// send the announcement to the configured channel, then mark the row
// `published` with the returned message id, or `failed` with the error. One
// flush per row so a mid-batch failure keeps the rows already sent. A `failed`
// row is re-selected after a backoff until `retryCount` hits MAX_ATTEMPTS, so a
// transient Telegram error no longer permanently drops the announcement.
//
// Cron-driven, so it lives in services/shared/ and owns its own flush-per-row
// (D15) — no facade / CQRS for a pure poller.
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

    const retryCutoff = DateTime.now().minus({
      minutes: RETRY_BACKOFF_MINUTES,
    });

    const due = await this.em.find(
      PostPublication,
      {
        platform: PublicationPlatform.Telegram,
        retryCount: { $lt: MAX_ATTEMPTS },
        $or: [
          { status: PublicationStatus.Pending },
          {
            status: PublicationStatus.Failed,
            updatedAt: { $lte: retryCutoff },
          },
        ],
      },
      { orderBy: { createdAt: 'asc' }, limit: BATCH_SIZE },
    );

    for (const publication of due) {
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
      publication.retryCount += 1;
      publication.errorMessage =
        err instanceof Error ? err.message : String(err);
      this.logger.error(
        { err, postId: publication.postId, retryCount: publication.retryCount },
        'telegram publication failed',
      );
    }
  }
}
