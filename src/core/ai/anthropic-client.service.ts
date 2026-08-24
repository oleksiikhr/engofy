import Anthropic from '@anthropic-ai/sdk';
import type { AiClient, AiToolCallParams } from './ai-client.port.js';

export class AnthropicClientService implements AiClient {
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
      thinking: { type: 'adaptive' },
      system,
      tools: [
        {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: userText }],
    });

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
