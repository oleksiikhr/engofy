export const AI_CLIENT = Symbol('AI_CLIENT');

export interface AiCompleteParams {
  system: string;
  userText: string;
}

export interface AiClient {
  complete(params: AiCompleteParams): Promise<string>;
}
