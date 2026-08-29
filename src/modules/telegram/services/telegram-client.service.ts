import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import TelegramConfig from '../config/telegram.config.js';

// One Telegram message inside a getUpdates result. Only the fields the admin
// bot needs are typed; the full payload is stored raw on telegram_updates.
export interface TelegramMessage {
  message_id: number;
  text?: string;
  from?: { id: number; username?: string };
  chat: { id: number };
}

export interface TelegramUpdatePayload {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

// Thin wrapper over the Telegram Bot HTTP API — long-polling getUpdates and
// sendMessage are all V1 needs, so this is raw `fetch`, no client library.
@Injectable()
export class TelegramClientService {
  constructor(
    @Inject(TelegramConfig.KEY)
    private readonly config: ConfigType<typeof TelegramConfig>,
  ) {}

  get configured(): boolean {
    return this.config.botToken !== '';
  }

  async getUpdates(offset?: number): Promise<TelegramUpdatePayload[]> {
    return this.call<TelegramUpdatePayload[]>('getUpdates', {
      ...(offset !== undefined && { offset }),
      timeout: 0,
      allowed_updates: ['message'],
    });
  }

  async sendMessage(
    chatId: string,
    text: string,
  ): Promise<{ message_id: number }> {
    return this.call<{ message_id: number }>('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    });
  }

  private async call<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.config.apiBaseUrl}/bot${this.config.botToken}/${method}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(`telegram ${method} request failed`, { cause: err });
    }

    const payload = (await response
      .json()
      .catch(() => null)) as TelegramApiResponse<T> | null;

    if (!response.ok || !payload?.ok) {
      throw new Error(
        `telegram ${method} responded ${response.status}: ${payload?.description ?? '(no body)'}`,
      );
    }

    return payload.result;
  }
}
