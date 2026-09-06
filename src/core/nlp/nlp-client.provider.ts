import type { FactoryProvider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HttpNlpClientService } from './http-nlp-client.service.js';
import NlpConfig from './nlp.config.js';
import { NLP_CLIENT } from './nlp-client.port.js';

export const nlpClientProvider: FactoryProvider = {
  provide: NLP_CLIENT,
  inject: [NlpConfig.KEY],
  useFactory: (config: ConfigType<typeof NlpConfig>) =>
    new HttpNlpClientService(config.baseUrl, config.timeoutMs),
};
