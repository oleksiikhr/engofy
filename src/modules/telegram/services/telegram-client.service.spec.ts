import type { ConfigType } from '@nestjs/config';
import type TelegramConfig from '../config/telegram.config.js';
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

  it('throws with status + description when the API answers not-ok', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: false, description: 'forbidden' }, 403),
    );

    await expect(client().sendMessage('@chan', 'hi')).rejects.toThrow(
      API_ERROR,
    );
  });

  it('throws when HTTP is 200 but the payload ok flag is false', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false }, 200));

    await expect(client().sendMessage('@chan', 'hi')).rejects.toThrow(
      API_ERROR_200,
    );
  });
});
