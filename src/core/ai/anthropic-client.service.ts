import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import type { AiClient, AiToolCallParams } from './ai-client.port.js';

// $ per 1M tokens, matched against `model` by substring — see the "Current
// Models" pricing table in Anthropic's docs. Update alongside AI_MODEL.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'opus-5': { input: 5, output: 25 },
  'sonnet-5': { input: 3, output: 15 },
  'fable-5': { input: 10, output: 50 },
  'haiku-4-5': { input: 1, output: 5 },
  'opus-4-8': { input: 5, output: 25 },
  'opus-4-7': { input: 5, output: 25 },
  'opus-4-6': { input: 5, output: 25 },
  'sonnet-4-6': { input: 3, output: 15 },
};

// Adaptive thinking is only supported on Sonnet 5 / Opus 5 / Fable 5 and the
// 4.6+ family — Haiku models 400 on `thinking: { type: 'adaptive' }`.
function supportsAdaptiveThinking(model: string): boolean {
  return !model.includes('haiku');
}

function estimateCostUsd(
  model: string,
  usage: Anthropic.Usage,
): number | undefined {
  const rates = Object.entries(PRICING_PER_MTOK).find(([key]) =>
    model.includes(key),
  )?.[1];
  if (!rates) {
    return undefined;
  }

  return (
    (usage.input_tokens * rates.input + usage.output_tokens * rates.output) /
    1_000_000
  );
}

export class AnthropicClientService implements AiClient {
  private readonly logger = new Logger(AnthropicClientService.name);
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async runTool<T>({ system, userText, tool }: AiToolCallParams): Promise<T> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      ...(supportsAdaptiveThinking(this.model) && {
        thinking: { type: 'adaptive' },
      }),
      system,
      tools: [
        {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
          ...(tool.strict !== undefined && { strict: tool.strict }),
        },
      ],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: userText }],
    });

    this.logger.log(
      {
        model: this.model,
        tool: tool.name,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens:
          response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cost_usd: estimateCostUsd(this.model, response.usage),
      },
      'ai tool call usage',
    );

    const block = response.content.find(
      (candidate): candidate is Anthropic.ToolUseBlock =>
        candidate.type === 'tool_use',
    );

    if (!block) {
      throw new Error(
        `AI response for tool "${tool.name}" contained no tool_use block (stop_reason: ${response.stop_reason})`,
      );
    }

    return block.input as T;
  }
}
