import type {
  TelegramClientService,
  TelegramUpdatePayload,
} from '../../src/modules/telegram/services/telegram-client.service.js';

/**
 * Canonical fake for `TelegramClientService`. That service is a plain
 * `@Injectable` (no port interface — D9), so the fake conforms structurally
 * via `implements Pick<…>` and is injected with
 * `.overrideProvider(TelegramClientService).useValue(...)`.
 *
 * Replaces the bespoke `FakeTelegramClient` copies in `poll-updates` /
 * `publish-pending` (Batch I / D17).
 */
export class FakeTelegramClient
  implements
    Pick<TelegramClientService, 'configured' | 'getUpdates' | 'sendMessage'>
{
  configured = true;

  /** Payloads `getUpdates` returns. */
  queued: TelegramUpdatePayload[] = [];
  /** Every `offset` arg `getUpdates` was called with, in order. */
  offsets: (number | undefined)[] = [];
  /** Every message `sendMessage` accepted, in order. */
  sent: { chatId: string; text: string }[] = [];

  /** When true, every `sendMessage` throws. */
  failSendMessage = false;
  /** One-shot: thrown (and cleared) on the next `sendMessage`. */
  nextError: Error | null = null;
  /** `message_id` returned by a successful `sendMessage`. */
  nextMessageId = 1;

  async getUpdates(offset?: number): Promise<TelegramUpdatePayload[]> {
    this.offsets.push(offset);
    return this.queued;
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
    if (this.failSendMessage) {
      throw new Error('telegram sendMessage failed (fake)');
    }
    this.sent.push({ chatId, text });
    return { message_id: this.nextMessageId };
  }
}
