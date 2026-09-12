import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireEnv } from './env.js';

// Same pricing table as call-claude.ts / src/core/ai/anthropic-client.service.ts
// — duplicated deliberately, see call-claude.ts's comment on why this harness
// never imports it from src/.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'opus-5': { input: 5, output: 25 },
  'sonnet-5': { input: 2, output: 10 },
  'fable-5': { input: 10, output: 50 },
  'haiku-4-5': { input: 1, output: 5 },
};

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

export interface StructuredCallResult<T> {
  data: T;
  model: string;
  truncated: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd?: number;
    elapsedMs: number;
  };
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  return client;
}

// Direct-transport equivalent of AnthropicClientService.completeStructured —
// same forced tool_choice / z.toJSONSchema input_schema / max_tokens
// truncation check / schema.safeParse contract, just without Nest DI. Throws
// on truncation or a schema-shape mismatch, exactly like production, so a
// harness run surfaces the same failure modes a real pipeline run would.
export async function callClaudeStructured<T>(params: {
  system: string;
  userText: string;
  tool: { name: string; description: string; schema: z.ZodType<T> };
  model?: string;
  thinking?: boolean;
  maxTokens?: number;
}): Promise<StructuredCallResult<T>> {
  const model = params.model ?? requireEnv('AI_MODEL');
  // Same z.toJSONSchema(...) call as AnthropicClientService.completeStructured
  // — strips the JSON Schema dialect marker Anthropic's input_schema
  // validator doesn't want.
  const { $schema: _schema, ...inputSchema } = z.toJSONSchema(
    params.tool.schema,
  ) as Record<string, unknown>;

  const start = performance.now();
  const response = await getClient()
    .messages.stream({
      model,
      max_tokens: params.maxTokens ?? 16000,
      ...(params.thinking && { thinking: { type: 'adaptive' } }),
      system: params.system,
      tools: [
        {
          name: params.tool.name,
          description: params.tool.description,
          input_schema: inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: params.tool.name },
      messages: [{ role: 'user', content: params.userText }],
    })
    .finalMessage();
  const elapsedMs = performance.now() - start;

  const truncated = response.stop_reason === 'max_tokens';
  if (truncated) {
    throw new Error(
      `AI response was truncated by max_tokens — output_tokens=${response.usage.output_tokens}`,
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === params.tool.name,
  );
  if (!toolUse) {
    throw new Error(
      `AI response did not call the forced tool "${params.tool.name}" (stop_reason=${response.stop_reason})`,
    );
  }

  const parsed = params.tool.schema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `AI response did not match the "${params.tool.name}" schema: ${parsed.error.message}`,
    );
  }

  return {
    data: parsed.data,
    model,
    truncated,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costUsd: estimateCostUsd(model, response.usage),
      elapsedMs,
    },
  };
}
