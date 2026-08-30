import { registerAs } from '@nestjs/config';
import { envBool, envNumber, envString } from '../helpers/env.helper.js';

export default registerAs('mail', () => ({
  resendApiKey: envString('RESEND_API_KEY', ''),
  fromEmail: envString('MAIL_FROM_EMAIL', 'Engofy <onboarding@engofy.com>'),
  // Explicit opt-in for the local MailHog SMTP sink. Without it (and without a
  // Resend key) the mailer falls back to `ConsoleMailerService`, or refuses to
  // boot in production — see `mailer.provider.ts`.
  useMailhog: envBool('MAIL_USE_MAILHOG'),
  mailhogHost: envString('MAILHOG_HOST', '127.0.0.1'),
  mailhogPort: envNumber('MAILHOG_PORT', 1025),
}));
