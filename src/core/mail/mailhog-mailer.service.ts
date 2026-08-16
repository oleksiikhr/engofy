import nodemailer, { type Transporter } from 'nodemailer';
import type { Mailer, MailMessage } from './mailer.port.js';

export class MailhogMailerService implements Mailer {
  private readonly transport: Transporter;

  constructor(
    host: string,
    port: number,
    private readonly fromEmail: string,
  ) {
    this.transport = nodemailer.createTransport({ host, port, secure: false });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.fromEmail,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
