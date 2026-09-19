import type { ConfigType } from '@nestjs/config';
import { FakeMailer } from '../../../../../test/fakes/mailer.fake.js';
import type AppConfig from '../../../../core/config/app.config.js';
import { AccountDeletionMailerService } from './account-deletion-mailer.service.js';

describe('AccountDeletionMailerService', () => {
  const appConfig = {
    publicUrl: 'https://engofy.test/',
  } as ConfigType<typeof AppConfig>;

  it('mails a cancel link built from the public URL and the token', async () => {
    const mailer = new FakeMailer();
    const service = new AccountDeletionMailerService(mailer, appConfig);

    await service.sendAccountDeletionEmail({
      email: 'user@example.com',
      cancelToken: 'tok/en',
      scheduledFor: '2026-10-19T08:00:00.000Z',
    });

    expect(mailer.sent).toHaveLength(1);
    const [message] = mailer.sent;
    expect(message.to).toBe('user@example.com');
    expect(message.text).toContain(
      'https://engofy.test/account-deletion/cancel?token=tok%2Fen',
    );
    expect(message.text).toContain('2026-10-19');
  });

  it('propagates a transport failure', async () => {
    const mailer = new FakeMailer();
    mailer.nextError = new Error('resend 500');
    const service = new AccountDeletionMailerService(mailer, appConfig);

    await expect(
      service.sendAccountDeletionEmail({
        email: 'x@y.z',
        cancelToken: 'token',
        scheduledFor: '2026-10-19T08:00:00.000Z',
      }),
    ).rejects.toThrow('resend 500');
  });
});
