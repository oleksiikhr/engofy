import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../helpers/env.helper.js';

export default registerAs('mail', () => ({
  resendApiKey: envString('RESEND_API_KEY', ''),
  fromEmail: envString('MAIL_FROM_EMAIL', 'Engofy <onboarding@engofy.com>'),
  mailhogHost: envString('MAILHOG_HOST', '127.0.0.1'),
  mailhogPort: envNumber('MAILHOG_PORT', 1025),
}));
