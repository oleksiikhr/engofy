import { FakeMailer } from '../../../../../test/fakes/mailer.fake.js';
import { renderChallengeEmail } from '../../mails/challenge-email.template.js';
import { ChallengeMailerService } from './challenge-mailer.service.js';

describe('ChallengeMailerService', () => {
  it('renders the challenge email and sends it to the address', async () => {
    const mailer = new FakeMailer();
    const service = new ChallengeMailerService(mailer);

    await service.sendChallengeEmail({
      email: 'user@example.com',
      otp: '123456',
    });

    expect(mailer.sent).toHaveLength(1);
    const [message] = mailer.sent;
    const expected = renderChallengeEmail({ otp: '123456' });

    expect(message).toEqual({
      to: 'user@example.com',
      subject: expected.subject,
      text: expected.text,
      html: expected.html,
    });
    expect(message.text).toContain('123456');
  });

  it('propagates a transport failure', async () => {
    const mailer = new FakeMailer();
    mailer.nextError = new Error('resend 500');
    const service = new ChallengeMailerService(mailer);

    await expect(
      service.sendChallengeEmail({ email: 'x@y.z', otp: '000000' }),
    ).rejects.toThrow('resend 500');
  });
});
