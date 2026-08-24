import type { FactoryProvider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import AiConfig from './ai.config.js';
import { AI_CLIENT } from './ai-client.port.js';
import { AnthropicClientService } from './anthropic-client.service.js';

export const aiClientProvider: FactoryProvider = {
  provide: AI_CLIENT,
  inject: [AiConfig.KEY],
  useFactory: (config: ConfigType<typeof AiConfig>) =>
    new AnthropicClientService(config.anthropicApiKey, config.model),
};
