import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import AppConfig from '../../../../core/config/app.config.js';
import { MAILER, type Mailer } from '../../../../core/mail/mailer.port.js';
import { renderAccountDeletionEmail } from '../../mails/account-deletion-email.template.js';

const TRAILING_SLASHES = /\/+$/;

export interface SendAccountDeletionEmailInput {
  email: string;
  cancelToken: string;
  scheduledFor: string;
}

@Injectable()
export class AccountDeletionMailerService {
  constructor(
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(AppConfig.KEY)
    private readonly appConfig: ConfigType<typeof AppConfig>,
  ) {}

  async sendAccountDeletionEmail(
    input: SendAccountDeletionEmailInput,
  ): Promise<void> {
    const { email, cancelToken, scheduledFor } = input;

    const base = (this.appConfig.publicUrl ?? '').replace(TRAILING_SLASHES, '');
    const cancelUrl = `${base}/account-deletion/cancel?token=${encodeURIComponent(cancelToken)}`;

    const { subject, text, html } = renderAccountDeletionEmail({
      cancelUrl,
      scheduledFor: DateTime.fromISO(scheduledFor, { zone: 'utc' }).toFormat(
        'yyyy-LL-dd',
      ),
    });

    await this.mailer.send({ to: email, subject, text, html });
  }
}
