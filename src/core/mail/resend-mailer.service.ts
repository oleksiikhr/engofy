import { Resend } from 'resend';
import type { Mailer, MailMessage } from './mailer.port.js';

export class ResendMailerService implements Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: MailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.fromEmail,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`, { cause: error });
    }
  }
}
