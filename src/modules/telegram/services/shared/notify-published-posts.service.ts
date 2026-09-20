import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import AppConfig from '../../../../core/config/app.config.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import TelegramConfig from '../../config/telegram.config.js';
import { formatPublishNotice } from '../../domain/format-publish-notice.js';
import { TelegramClientService } from '../telegram-client.service.js';

const BATCH_SIZE = 10;

// Tells the admin (TELEGRAM_ADMIN_USER_ID) when a post lands in `published`.
// A `published` post with `publish_notified_at` null is a notice still owed;
// the column is stamped after a successful send so the next tick skips it, and
// `retry` clears it so a re-published post notifies again. A failed send leaves
// the column null and ends the tick (same reasoning as NotifyFailedPostsService);
// the next tick tries again.
//
// Cron-driven, so it lives in services/shared/ and owns its own flush-per-row
// (D15) — no facade / CQRS for a pure poller.
@Injectable()
export class NotifyPublishedPostsService {
  private readonly logger = new Logger(NotifyPublishedPostsService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly client: TelegramClientService,
    @Inject(TelegramConfig.KEY)
    private readonly config: ConfigType<typeof TelegramConfig>,
    @Inject(AppConfig.KEY)
    private readonly appConfig: ConfigType<typeof AppConfig>,
  ) {}

  async run(): Promise<void> {
    if (!this.client.configured || this.config.adminUserId === '') {
      return;
    }

    const posts = await this.em.find(
      Post,
      { status: PostStatus.Published, publishNotifiedAt: null },
      { orderBy: { publishedAt: 'asc' }, limit: BATCH_SIZE },
    );

    for (const post of posts) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one send + one flush per row so a failure mid-batch keeps the notices already sent.
        await this.client.sendMessage(
          this.config.adminUserId,
          formatPublishNotice(post, this.appConfig.publicUrl ?? ''),
        );
      } catch (err) {
        this.logger.error(
          { err, postId: post.id },
          'post publish notice send failed',
        );
        return;
      }

      post.publishNotifiedAt = DateTime.now();
      await this.em.flush();
      this.logger.log({ postId: post.id }, 'post publish notice sent');
    }
  }
}
