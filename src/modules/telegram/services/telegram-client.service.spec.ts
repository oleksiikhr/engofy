import type { ConfigType } from '@nestjs/config';
import type TelegramConfig from '../config/telegram.config.js';
import { TelegramApiError } from '../errors/telegram-api.error.js';
import { TelegramClientService } from './telegram-client.service.js';

const REQUEST_FAILED = /telegram getUpdates request failed/;
const API_ERROR = /telegram sendMessage responded 403: forbidden/;
const API_ERROR_200 = /responded 200/;

function client(
  overrides: Partial<ConfigType<typeof TelegramConfig>> = {},
): TelegramClientService {
  return new TelegramClientService({
    botToken: 'BOT:TOKEN',
    adminUserId: '',
    channelId: '',
    apiBaseUrl: 'https://tg.test',
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TelegramClientService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports configured only when a bot token is set', () => {
    expect(client().configured).toBe(true);
    expect(client({ botToken: '' }).configured).toBe(false);
  });

  it('calls getUpdates with a short poll (timeout 0) and message-only updates', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: [] }));

    await client().getUpdates(42);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://tg.test/botBOT:TOKEN/getUpdates');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      offset: 42,
      timeout: 0,
      allowed_updates: ['message'],
    });
  });

  it('omits offset when none is given and unwraps result', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, result: [{ update_id: 7 }] }),
    );

    const updates = await client().getUpdates();

    expect(updates).toEqual([{ update_id: 7 }]);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body as string),
    ).not.toHaveProperty('offset');
  });

  it('wraps a transport failure with the method name as the cause', async () => {
    const boom = new Error('network down');
    fetchMock.mockRejectedValue(boom);

    await expect(client().getUpdates()).rejects.toThrow(REQUEST_FAILED);
    await expect(client().getUpdates()).rejects.toMatchObject({ cause: boom });
  });

  it('throws a TelegramApiError with status + description when the API answers not-ok', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: false, description: 'forbidden' }, 403),
    );

    const err = await client()
      .sendMessage('@chan', 'hi')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TelegramApiError);
    expect(err).toMatchObject({ method: 'sendMessage', status: 403 });
    expect((err as Error).message).toMatch(API_ERROR);
    expect((err as TelegramApiError).isRateLimited).toBe(false);
  });

  it('carries retry_after and flags a 429 as rate-limited', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          ok: false,
          description: 'Too Many Requests',
          parameters: { retry_after: 12 },
        },
        429,
      ),
    );

    const err = (await client()
      .sendMessage('@chan', 'hi')
      .catch((e: unknown) => e)) as TelegramApiError;
    expect(err).toBeInstanceOf(TelegramApiError);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(12);
    expect(err.isRateLimited).toBe(true);
    expect(err.message).toContain('retry_after=12s');
  });

  it('throws when HTTP is 200 but the payload ok flag is false', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false }, 200));

    await expect(client().sendMessage('@chan', 'hi')).rejects.toThrow(
      API_ERROR_200,
    );
  });
});
