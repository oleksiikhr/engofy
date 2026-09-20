import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Post } from '../../../post/entities/post.entity.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { PostService } from '../../../post/post.service.js';
import TelegramConfig from '../../config/telegram.config.js';
import { formatFailureAlert } from '../../domain/format-failure-alert.js';
import { TelegramClientService } from '../telegram-client.service.js';

const BATCH_SIZE = 10;

// Tells the admin (TELEGRAM_ADMIN_USER_ID) when a post lands in `failed` —
// `JobWorkerHost` flips it there once a stage exhausts its pg-boss attempts.
// A `failed` post with `failure_notified_at` null is an alert still owed; the
// column is stamped after a successful send so the next tick skips it, and
// `retry` clears it so a fresh failure alerts again. A failed send leaves the
// column null and ends the tick (Telegram is down or the admin blocked the
// bot — retrying the rest of the batch would just repeat it); the next tick
// tries again.
//
// Cron-driven, so it lives in services/shared/ and owns its own flush-per-row
// (D15) — no facade / CQRS for a pure poller.
@Injectable()
export class NotifyFailedPostsService {
  private readonly logger = new Logger(NotifyFailedPostsService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly client: TelegramClientService,
    private readonly postService: PostService,
    @Inject(TelegramConfig.KEY)
    private readonly config: ConfigType<typeof TelegramConfig>,
  ) {}

  async run(): Promise<void> {
    if (!this.client.configured || this.config.adminUserId === '') {
      return;
    }

    const posts = await this.em.find(
      Post,
      { status: PostStatus.Failed, failureNotifiedAt: null },
      { orderBy: { updatedAt: 'asc' }, limit: BATCH_SIZE },
    );

    for (const post of posts) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one send + one flush per row so a failure mid-batch keeps the alerts already sent.
      const { items } = await this.postService.getPostPipelineStatus(
        post.id,
        1,
      );
      const view = items[0];
      if (!view) {
        continue;
      }

      try {
        await this.client.sendMessage(
          this.config.adminUserId,
          formatFailureAlert(view),
        );
      } catch (err) {
        this.logger.error(
          { err, postId: post.id },
          'post failure alert send failed',
        );
        return;
      }

      post.failureNotifiedAt = DateTime.now();
      await this.em.flush();
      this.logger.log({ postId: post.id }, 'post failure alert sent');
    }
  }
}
