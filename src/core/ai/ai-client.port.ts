export const AI_CLIENT = Symbol('AI_CLIENT');

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AiToolCallParams {
  system: string;
  userText: string;
  tool: AiToolDefinition;
}

export interface AiClient {
  runTool<T>(params: AiToolCallParams): Promise<T>;
}
