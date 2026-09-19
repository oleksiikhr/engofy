import type { AccountDeletionMailerService } from '../../../modules/auth/services/shared/account-deletion-mailer.service.js';
import { SendAccountDeletionEmailProcessor } from './send-account-deletion-email.processor.js';

interface Exposed {
  pipelineStage(job: unknown): unknown;
  processJob(job: unknown): Promise<void>;
}

describe('SendAccountDeletionEmailProcessor', () => {
  const build = () => {
    const sendAccountDeletionEmail = vi.fn().mockResolvedValue(undefined);
    const processor = new SendAccountDeletionEmailProcessor({
      sendAccountDeletionEmail,
    } as unknown as AccountDeletionMailerService) as unknown as Exposed;
    return { processor, sendAccountDeletionEmail };
  };

  it('delegates processJob to the mailer with the job data', async () => {
    const { processor, sendAccountDeletionEmail } = build();
    const data = {
      email: 'user@example.com',
      cancelToken: 'token',
      scheduledFor: '2026-10-19T08:00:00.000Z',
    };

    await processor.processJob({ data });

    expect(sendAccountDeletionEmail).toHaveBeenCalledWith(data);
  });

  it('is not a pipeline stage', () => {
    const { processor } = build();
    expect(processor.pipelineStage({ data: {} })).toBeNull();
  });
});
