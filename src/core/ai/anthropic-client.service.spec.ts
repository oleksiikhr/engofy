import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiSchemaMismatchError } from './ai-schema-mismatch.error.js';
import { AnthropicClientService } from './anthropic-client.service.js';

// The service streams every call (`messages.stream(...).finalMessage()`), so the
// fake `stream` returns an object with a `finalMessage()` promise (re-wired in
// `beforeEach`); the per-test response is set on `finalMessage`.
const finalMessage = vi.fn();
const stream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    messages = { stream };
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
    finalMessage.mockReset();
    stream.mockReset();
    stream.mockReturnValue({ finalMessage });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('complete', () => {
    it('streams the request and reads the assembled final message', async () => {
      finalMessage.mockResolvedValue(textResponse('streamed'));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      const out = await client.complete({ system: 's', userText: 'u' });

      expect(out).toBe('streamed');
      expect(stream).toHaveBeenCalledTimes(1);
      expect(finalMessage).toHaveBeenCalledTimes(1);
      // A non-streaming `messages.create` would trip the SDK 10-minute timeout
      // on a ~2-minute echo-back — the adapter must never fall back to it.
      expect(stream.mock.calls[0][0]).not.toHaveProperty('stream');
    });

    it('joins the text blocks of the response', async () => {
      finalMessage.mockResolvedValue({
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
      finalMessage.mockResolvedValue(
        textResponse('partial', { stop_reason: 'max_tokens' }),
      );
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await expect(
        client.complete({ system: 's', userText: 'u' }),
      ).rejects.toThrow('truncated by max_tokens');
    });

    it('sends adaptive thinking only for allowlisted models', async () => {
      finalMessage.mockResolvedValue(textResponse('ok'));

      await new AnthropicClientService('key', 'claude-sonnet-5').complete({
        system: 's',
        userText: 'u',
      });
      expect(stream.mock.calls[0][0].thinking).toEqual({ type: 'adaptive' });

      // Haiku 400s on adaptive thinking.
      stream.mockClear();
      await new AnthropicClientService('key', 'claude-haiku-4-5').complete({
        system: 's',
        userText: 'u',
      });
      expect(stream.mock.calls[0][0]).not.toHaveProperty('thinking');

      // An unknown / pre-4.6 model id is not on the allowlist either.
      stream.mockClear();
      await new AnthropicClientService('key', 'claude-3-5-sonnet').complete({
        system: 's',
        userText: 'u',
      });
      expect(stream.mock.calls[0][0]).not.toHaveProperty('thinking');
    });
  });

  describe('completeStructured', () => {
    it('strips the $schema marker from the tool input_schema', async () => {
      finalMessage.mockResolvedValue(toolResponse({ level: 'B2' }));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await client.completeStructured({
        system: 's',
        userText: 'u',
        tool: TOOL,
      });

      const inputSchema = stream.mock.calls[0][0].tools[0].input_schema;
      expect(inputSchema).not.toHaveProperty('$schema');
      expect(inputSchema.type).toBe('object');
    });

    it('parses and returns the forced tool call input', async () => {
      finalMessage.mockResolvedValue(toolResponse({ level: 'C1' }));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      const out = await client.completeStructured({
        system: 's',
        userText: 'u',
        tool: TOOL,
      });

      expect(out).toEqual({ level: 'C1' });
    });

    it('throws when the model did not call the forced tool', async () => {
      finalMessage.mockResolvedValue(textResponse('no tool call here'));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await expect(
        client.completeStructured({ system: 's', userText: 'u', tool: TOOL }),
      ).rejects.toThrow('did not call the forced tool "assess"');
    });

    it('throws the truncation error before schema parsing on max_tokens', async () => {
      finalMessage.mockResolvedValue(
        toolResponse({}, { stop_reason: 'max_tokens' }),
      );
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await expect(
        client.completeStructured({ system: 's', userText: 'u', tool: TOOL }),
      ).rejects.toThrow('truncated by max_tokens');
    });

    it('throws AiSchemaMismatchError (not a raw ZodError) on a schema-invalid payload', async () => {
      // Model returned `level` as a number where the schema wants a string —
      // a shape violation, not a truncation.
      finalMessage.mockResolvedValue(toolResponse({ level: 42 }));
      const client = new AnthropicClientService('key', 'claude-sonnet-5');

      await expect(
        client.completeStructured({ system: 's', userText: 'u', tool: TOOL }),
      ).rejects.toBeInstanceOf(AiSchemaMismatchError);
    });
  });

  describe('system prompt caching', () => {
    const bigSystem = `catalogue preamble ${'x'.repeat(5000)}`;

    it('marks a large static system prompt as an ephemeral cache breakpoint', async () => {
      finalMessage.mockResolvedValue(textResponse('ok'));

      await new AnthropicClientService('key', 'claude-sonnet-5').complete({
        system: bigSystem,
        userText: 'u',
      });

      expect(stream.mock.calls[0][0].system).toEqual([
        {
          type: 'text',
          text: bigSystem,
          cache_control: { type: 'ephemeral' },
        },
      ]);
    });

    it('passes a short system prompt straight through as a string', async () => {
      finalMessage.mockResolvedValue(textResponse('ok'));

      await new AnthropicClientService('key', 'claude-sonnet-5').complete({
        system: 'short system prompt',
        userText: 'u',
      });

      expect(stream.mock.calls[0][0].system).toBe('short system prompt');
    });

    it('also caches the system prompt on completeStructured', async () => {
      finalMessage.mockResolvedValue(toolResponse({ level: 'B1' }));

      await new AnthropicClientService(
        'key',
        'claude-sonnet-5',
      ).completeStructured({ system: bigSystem, userText: 'u', tool: TOOL });

      expect(stream.mock.calls[0][0].system).toEqual([
        {
          type: 'text',
          text: bigSystem,
          cache_control: { type: 'ephemeral' },
        },
      ]);
    });
  });

  describe('cost logging', () => {
    it('prices a known model by substring match', async () => {
      finalMessage.mockResolvedValue({
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
      finalMessage.mockResolvedValue({
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
