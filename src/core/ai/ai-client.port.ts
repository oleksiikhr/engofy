export const AI_CLIENT = Symbol('AI_CLIENT');

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // Guarantees tool_use.input validates exactly against inputSchema — see
  // Anthropic's strict tool use. Requires additionalProperties: false at
  // every object level of inputSchema (top-level and nested), or the API
  // rejects the request with a 400.
  strict?: boolean;
}

export interface AiToolCallParams {
  system: string;
  userText: string;
  tool: AiToolDefinition;
}

export interface AiClient {
  runTool<T>(params: AiToolCallParams): Promise<T>;
}
