import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Post } from '../../../post/entities/post.entity.js';
import { PostService } from '../../../post/post.service.js';
import TelegramConfig from '../../config/telegram.config.js';
import { formatStuckAlert } from '../../domain/format-stuck-alert.js';
import { TelegramClientService } from '../telegram-client.service.js';

const BATCH_SIZE = 10;

interface StuckRow {
  id: string;
  // Epoch millis — the driver's timestamptz text format is not worth parsing.
  last_activity_ms: number;
}

// Tells the admin (TELEGRAM_ADMIN_USER_ID) when a post sits in `processing`
// with no pipeline activity for `stuckPostMinutes` — covers what neither the
// failure alert nor the publish notice can: nothing threw, nothing moved (a
// dead worker, a stalled `publish` gate).
//
// Activity = the newest `post_pipeline_runs.updated_at` (falling back to the
// post's `created_at`); every stage writes its run row on start and finish. An
// alert is owed while activity is older than the cutoff and newer than
// `stuck_notified_at`, so it is sent once per idle stretch: any later activity
// (or a `retry`, which recreates the runs) re-arms it. A failed send leaves the
// stamp untouched and ends the tick (same reasoning as NotifyFailedPostsService);
// the next tick tries again.
//
// Cron-driven, so it lives in services/shared/ and owns its own flush-per-row
// (D15) — no facade / CQRS for a pure poller.
@Injectable()
export class NotifyStuckPostsService {
  private readonly logger = new Logger(NotifyStuckPostsService.name);

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

    const now = DateTime.now();
    const cutoff = now.minus({ minutes: this.config.stuckPostMinutes });

    const rows = await this.em.getConnection().execute<StuckRow[]>(
      `SELECT p.id,
              EXTRACT(EPOCH FROM COALESCE(MAX(r.updated_at), p.created_at))::float8 * 1000 AS last_activity_ms
       FROM posts p
       LEFT JOIN post_pipeline_runs r ON r.post_id = p.id
       WHERE p.status = 'processing'
       GROUP BY p.id
       HAVING COALESCE(MAX(r.updated_at), p.created_at) < ?
         AND (p.stuck_notified_at IS NULL
              OR p.stuck_notified_at < COALESCE(MAX(r.updated_at), p.created_at))
       ORDER BY last_activity_ms ASC
       LIMIT ?`,
      [cutoff.toJSDate(), BATCH_SIZE],
      'all',
      this.em.getTransactionContext(),
    );

    for (const row of rows) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one send + one flush per row so a failure mid-batch keeps the alerts already sent.
      const { items } = await this.postService.getPostPipelineStatus(row.id, 1);
      const view = items[0];
      if (!view) {
        continue;
      }

      const idleMinutes = Math.floor(
        now.diff(DateTime.fromMillis(Number(row.last_activity_ms)), 'minutes')
          .minutes,
      );

      try {
        await this.client.sendMessage(
          this.config.adminUserId,
          formatStuckAlert(view, idleMinutes),
        );
      } catch (err) {
        this.logger.error(
          { err, postId: row.id },
          'post stuck alert send failed',
        );
        return;
      }

      const post = await this.em.findOneOrFail(Post, row.id);
      post.stuckNotifiedAt = DateTime.now();
      await this.em.flush();
      this.logger.log({ postId: row.id, idleMinutes }, 'post stuck alert sent');
    }
  }
}
