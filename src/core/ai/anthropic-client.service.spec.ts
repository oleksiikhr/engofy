import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { AnthropicClientService } from './anthropic-client.service.js';

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    messages = { create };
  },
}));

function textResponse(text: string, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 1000, output_tokens: 500 },
    stop_reason: 'end_turn',
    ...extra,
  };
}

function toolResponse(input: unknown, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'tool_use', name: 'assess', input }],
    usage: { input_tokens: 1000, output_tokens: 500 },
    stop_reason: 'tool_use',
    ...extra,
  };
}

const TOOL = {
  name: 'assess',
  description: 'assess the text',
  schema: z.object({ level: z.string() }),
};

describe('AnthropicClientService', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    create.mockReset();
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('complete', () => {
    it('joins the text blocks of the response', async () => {
      create.mockResolvedValue({
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'thinking', thinking: 'ignored' },
          { type: 'text', text: 'world' },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: 'end_turn',
      });
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      const out = await client.complete({ system: 'sys', userText: 'hi' });

      expect(out).toBe('Hello world');
    });

    it('throws a distinct truncation error on stop_reason max_tokens', async () => {
      create.mockResolvedValue(
        textResponse('partial', { stop_reason: 'max_tokens' }),
      );
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await expect(
        client.complete({ system: 's', userText: 'u' }),
      ).rejects.toThrow('truncated by max_tokens');
    });

    it('sends adaptive thinking for sonnet but not for haiku', async () => {
      create.mockResolvedValue(textResponse('ok'));

      await new AnthropicClientService('key', 'claude-sonnet-5').complete({
        system: 's',
        userText: 'u',
      });
      expect(create.mock.calls[0][0].thinking).toEqual({ type: 'adaptive' });

      create.mockClear();
      await new AnthropicClientService('key', 'claude-haiku-4-5').complete({
        system: 's',
        userText: 'u',
      });
      expect(create.mock.calls[0][0]).not.toHaveProperty('thinking');
    });
  });

  describe('completeStructured', () => {
    it('strips the $schema marker from the tool input_schema', async () => {
      create.mockResolvedValue(toolResponse({ level: 'B2' }));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await client.completeStructured({
        system: 's',
        userText: 'u',
        tool: TOOL,
      });

      const inputSchema = create.mock.calls[0][0].tools[0].input_schema;
      expect(inputSchema).not.toHaveProperty('$schema');
      expect(inputSchema.type).toBe('object');
    });

    it('parses and returns the forced tool call input', async () => {
      create.mockResolvedValue(toolResponse({ level: 'C1' }));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      const out = await client.completeStructured({
        system: 's',
        userText: 'u',
        tool: TOOL,
      });

      expect(out).toEqual({ level: 'C1' });
    });

    it('throws when the model did not call the forced tool', async () => {
      create.mockResolvedValue(textResponse('no tool call here'));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await expect(
        client.completeStructured({ system: 's', userText: 'u', tool: TOOL }),
      ).rejects.toThrow('did not call the forced tool "assess"');
    });

    it('throws the truncation error before schema parsing on max_tokens', async () => {
      create.mockResolvedValue(toolResponse({}, { stop_reason: 'max_tokens' }));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await expect(
        client.completeStructured({ system: 's', userText: 'u', tool: TOOL }),
      ).rejects.toThrow('truncated by max_tokens');
    });
  });

  describe('cost logging', () => {
    it('prices a known model by substring match', async () => {
      create.mockResolvedValue({
        content: [{ type: 'text', text: 'x' }],
        usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
        stop_reason: 'end_turn',
      });

      await new AnthropicClientService('key', 'claude-sonnet-5').complete({
        system: 's',
        userText: 'u',
      });

      // sonnet-5 = $2 in + $10 out per 1M tokens.
      const logged = logSpy.mock.calls.at(-1)?.[0] as { cost_usd: number };
      expect(logged.cost_usd).toBeCloseTo(12);
    });

    it('logs undefined cost for an unknown model', async () => {
      create.mockResolvedValue({
        content: [{ type: 'text', text: 'x' }],
        usage: { input_tokens: 100, output_tokens: 100 },
        stop_reason: 'end_turn',
      });

      await new AnthropicClientService('key', 'mystery-model').complete({
        system: 's',
        userText: 'u',
      });

      const logged = logSpy.mock.calls.at(-1)?.[0] as {
        cost_usd: number | undefined;
      };
      expect(logged.cost_usd).toBeUndefined();
    });
  });
});
