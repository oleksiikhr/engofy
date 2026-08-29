import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type {
  AiClient,
  AiCompleteParams,
  AiCompleteStructuredParams,
} from './ai-client.port.js';

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

  private logUsage(usage: Anthropic.Usage, label: string): void {
    this.logger.log(
      {
        model: this.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        cost_usd: estimateCostUsd(this.model, usage),
      },
      label,
    );
  }

  async completeStructured<T>({
    system,
    userText,
    tool,
  }: AiCompleteStructuredParams<T>): Promise<T> {
    // Strip the JSON Schema dialect marker — Anthropic's input_schema
    // validator only wants the object shape itself.
    const { $schema: _schema, ...inputSchema } = z.toJSONSchema(
      tool.schema,
    ) as Record<string, unknown>;

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
          input_schema: inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: userText }],
    });

    this.logUsage(response.usage, 'ai completeStructured call usage');

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === 'tool_use' && block.name === tool.name,
    );
    if (!toolUse) {
      throw new Error(
        `AI response did not call the forced tool "${tool.name}" (stop_reason=${response.stop_reason})`,
      );
    }

    return tool.schema.parse(toolUse.input);
  }

  async complete({ system, userText }: AiCompleteParams): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      ...(supportsAdaptiveThinking(this.model) && {
        thinking: { type: 'adaptive' },
      }),
      system,
      messages: [{ role: 'user', content: userText }],
    });

    this.logUsage(response.usage, 'ai complete call usage');

    // max_tokens cuts generation off mid-stream — the caller's own
    // completeness check (comparing the reconstructed plain text against
    // the original) would otherwise treat this identically to a model that
    // just stopped early for no reason, and retry indefinitely for a
    // structural budget problem a retry can't fix. Surface it distinctly.
    if (response.stop_reason === 'max_tokens') {
      throw new Error(
        `AI response was truncated by max_tokens — output_tokens=${response.usage.output_tokens}`,
      );
    }

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
}
