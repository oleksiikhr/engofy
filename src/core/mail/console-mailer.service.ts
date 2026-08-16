import { Logger } from '@nestjs/common';
import type { Mailer, MailMessage } from './mailer.port.js';

export class ConsoleMailerService implements Mailer {
  private readonly logger = new Logger(ConsoleMailerService.name);

  async send(message: MailMessage): Promise<void> {
    this.logger.warn(
      { to: message.to, subject: message.subject, text: message.text },
      'RESEND_API_KEY not set — logging email instead of sending it',
    );
  }
}
