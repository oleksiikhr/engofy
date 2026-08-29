import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PostType } from '../../post/enums/post-type.enum.js';
import { PostService } from '../../post/post.service.js';
import TelegramConfig from '../config/telegram.config.js';
import { parseTelegramCommand } from '../domain/parse-command.js';
import { TelegramUpdate } from '../entities/telegram-update.entity.js';
import {
  TelegramClientService,
  type TelegramUpdatePayload,
} from './telegram-client.service.js';

const UNKNOWN_COMMAND_REPLY =
  'Unknown command. Use "/add <text>" to ingest a post or "/retry <post_id>" to re-run its pipeline.';

// Polls Telegram getUpdates (PLAN.md §3.9), stores every new update on
// telegram_updates for audit, and acts on the ones sent by the configured
// admin: `/add <text>` -> ingest, `/retry <post_id>` -> full pipeline re-run.
// The next poll offset is derived from max(update_id) already stored, so no
// separate cursor is needed and a re-poll of a stored update is a no-op.
@Injectable()
export class PollUpdatesService {
  private readonly logger = new Logger(PollUpdatesService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly client: TelegramClientService,
    private readonly postService: PostService,
    @Inject(TelegramConfig.KEY)
    private readonly config: ConfigType<typeof TelegramConfig>,
  ) {}

  async run(): Promise<void> {
    if (!this.client.configured) {
      return;
    }

    const offset = await this.nextOffset();
    const updates = await this.client.getUpdates(offset);

    for (const update of updates) {
      const messageId = String(update.update_id);
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each update is stored, acted on, and flushed before the next so a mid-tick crash keeps confirmed progress.
      const seen = await this.em.count(TelegramUpdate, {
        telegramMessageId: messageId,
      });
      if (seen > 0) {
        continue;
      }

      const row = new TelegramUpdate();
      row.telegramMessageId = messageId;
      row.rawPayload = update as unknown as Record<string, unknown>;
      this.em.persist(row);

      await this.dispatch(update, row);
      row.processed = true;
      await this.em.flush();
    }
  }

  private async nextOffset(): Promise<number | undefined> {
    // Raw aggregate — pass the active transaction context so it sees rows
    // this same unit of work has already flushed (and so tests that run in a
    // rolled-back transaction see their own setup).
    const rows = await this.em
      .getConnection()
      .execute<{ max: string | null }[]>(
        'SELECT max(telegram_message_id) AS max FROM telegram_updates',
        [],
        'all',
        this.em.getTransactionContext(),
      );
    const max = rows[0]?.max;
    return max === null || max === undefined ? undefined : Number(max) + 1;
  }

  private async dispatch(
    update: TelegramUpdatePayload,
    row: TelegramUpdate,
  ): Promise<void> {
    const message = update.message;
    if (
      !message?.text ||
      !message.from ||
      String(message.from.id) !== this.config.adminUserId
    ) {
      return;
    }

    const chatId = String(message.chat.id);
    const command = parseTelegramCommand(message.text);

    try {
      if (command.kind === 'add') {
        const post = await this.postService.ingest({
          rawText: command.text,
          type: PostType.Post,
        });
        await this.client.sendMessage(
          chatId,
          `Queued. Post ${post.shortId} is processing.`,
        );
      } else if (command.kind === 'retry') {
        await this.postService.retry(command.postId);
        await this.client.sendMessage(
          chatId,
          `Re-running the pipeline for post ${command.postId}.`,
        );
      } else {
        await this.client.sendMessage(chatId, UNKNOWN_COMMAND_REPLY);
      }
    } catch (err) {
      this.logger.error(
        { err, updateId: row.telegramMessageId, command: command.kind },
        'telegram command failed',
      );
      await this.client
        .sendMessage(chatId, `Command failed: ${errorText(err)}`)
        .catch(() => undefined);
    }
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
