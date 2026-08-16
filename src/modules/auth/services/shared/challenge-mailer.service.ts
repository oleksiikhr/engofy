import { Inject, Injectable } from '@nestjs/common';
import { MAILER, type Mailer } from '../../../../core/mail/mailer.port.js';
import { renderChallengeEmail } from '../../mails/challenge-email.template.js';

export interface SendChallengeEmailInput {
  email: string;
  otp: string;
}

@Injectable()
export class ChallengeMailerService {
  constructor(@Inject(MAILER) private readonly mailer: Mailer) {}

  async sendChallengeEmail(input: SendChallengeEmailInput): Promise<void> {
    const { email, otp } = input;

    const { subject, text, html } = renderChallengeEmail({ otp });

    await this.mailer.send({ to: email, subject, text, html });
  }
}
