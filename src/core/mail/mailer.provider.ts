import type { FactoryProvider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import MailConfig from './mail.config.js';
import { MAILER } from './mailer.port.js';
import { MailhogMailerService } from './mailhog-mailer.service.js';
import { ResendMailerService } from './resend-mailer.service.js';

export const mailerProvider: FactoryProvider = {
  provide: MAILER,
  inject: [MailConfig.KEY],
  useFactory: (config: ConfigType<typeof MailConfig>) =>
    config.resendApiKey
      ? new ResendMailerService(config.resendApiKey, config.fromEmail)
      : new MailhogMailerService(
          config.mailhogHost,
          config.mailhogPort,
          config.fromEmail,
        ),
};
