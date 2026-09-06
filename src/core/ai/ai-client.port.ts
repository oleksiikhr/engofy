import type { ZodType } from 'zod';

export const AI_CLIENT = Symbol('AI_CLIENT');

export interface AiCompleteParams {
  system: string;
  userText: string;
}

export interface AiStructuredTool<T> {
  name: string;
  description: string;
  // Zod schema for the tool input. Used both to build the Anthropic
  // `input_schema` and to parse/validate the model's tool call.
  schema: ZodType<T>;
}

export interface AiCompleteStructuredParams<T> {
  system: string;
  userText: string;
  tool: AiStructuredTool<T>;
}

export interface AiClient {
  // Free-form text completion (used by the annotation stage's inline-tag
  // format).
  complete(params: AiCompleteParams): Promise<string>;

  // Forced single-tool call: the model must answer by calling `tool`, whose
  // input is validated against `tool.schema` and returned. For the small
  // structured outputs of ai_complexity / ai_grammar.
  completeStructured<T>(params: AiCompleteStructuredParams<T>): Promise<T>;
}
