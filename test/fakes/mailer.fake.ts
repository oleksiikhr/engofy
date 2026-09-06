import type { Mailer, MailMessage } from '../../src/core/mail/mailer.port.js';

/**
 * Canonical `Mailer` fake for the integration suites. Records every message;
 * set `nextError` to make the next `send` throw once.
 */
export class FakeMailer implements Mailer {
  sent: MailMessage[] = [];
  nextError: Error | null = null;

  async send(message: MailMessage): Promise<void> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    this.sent.push(message);
  }
}
