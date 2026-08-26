import Anthropic from '@anthropic-ai/sdk';
import { requireEnv } from './env.js';

// Same pricing table as src/core/ai/anthropic-client.service.ts — duplicated
// on purpose. This lib is a throwaway research harness that must never
// import from src/ for anything that could change the numbers it reports;
// keeping it standalone means a later edit to the production pricing table
// can't silently skew a draft comparison run from weeks earlier.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'opus-5': { input: 5, output: 25 },
  'sonnet-5': { input: 3, output: 15 },
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

export interface CallResult {
  text: string;
  model: string;
  stopReason: string | null;
  elapsedMs: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
    costUsd?: number;
  };
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  return client;
}

// Plain-text completion — no tool_use. The whole point of this harness is
// testing a prompt-defined inline tag format instead of a JSON tool schema,
// so this deliberately does NOT mirror AnthropicClientService.runTool().
export async function callClaude(params: {
  system: string;
  userText: string;
  model?: string;
  thinking?: boolean;
  maxTokens?: number;
}): Promise<CallResult> {
  const model = params.model ?? requireEnv('AI_MODEL');
  const start = performance.now();

  const response = await getClient().messages.create({
    model,
    max_tokens: params.maxTokens ?? 8000,
    ...(params.thinking && { thinking: { type: 'adaptive' } }),
    system: params.system,
    messages: [{ role: 'user', content: params.userText }],
  });

  const elapsedMs = performance.now() - start;
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return {
    text,
    model,
    stopReason: response.stop_reason,
    elapsedMs,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      costUsd: estimateCostUsd(model, response.usage),
    },
  };
}
