import type { FactoryProvider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { isProdEnvironment } from '../enums/environment.enum.js';
import { ConsoleMailerService } from './console-mailer.service.js';
import MailConfig from './mail.config.js';
import { MAILER } from './mailer.port.js';
import { MailhogMailerService } from './mailhog-mailer.service.js';
import { ResendMailerService } from './resend-mailer.service.js';

export const mailerProvider: FactoryProvider = {
  provide: MAILER,
  inject: [MailConfig.KEY],
  useFactory: (config: ConfigType<typeof MailConfig>) => {
    if (config.resendApiKey) {
      return new ResendMailerService(config.resendApiKey, config.fromEmail);
    }

    if (config.useMailhog) {
      return new MailhogMailerService(
        config.mailhogHost,
        config.mailhogPort,
        config.fromEmail,
      );
    }

    // No real transport configured. In production that is a misconfiguration
    // that would silently drop every email — fail the bootstrap instead.
    if (isProdEnvironment()) {
      throw new Error(
        'No mail transport configured: set RESEND_API_KEY, or MAIL_USE_MAILHOG=true for the local SMTP sink.',
      );
    }

    return new ConsoleMailerService();
  },
};
