import type { ChallengeMailerService } from '../../../modules/auth/services/shared/challenge-mailer.service.js';
import { SendChallengeEmailProcessor } from './send-challenge-email.processor.js';

interface Exposed {
  pipelineStage(job: unknown): unknown;
  processJob(job: unknown): Promise<void>;
}

describe('SendChallengeEmailProcessor', () => {
  const build = () => {
    const sendChallengeEmail = vi.fn().mockResolvedValue(undefined);
    const processor = new SendChallengeEmailProcessor({
      sendChallengeEmail,
    } as unknown as ChallengeMailerService) as unknown as Exposed;
    return { processor, sendChallengeEmail };
  };

  it('delegates processJob to challengeMailer.sendChallengeEmail with the job data', async () => {
    const { processor, sendChallengeEmail } = build();

    await processor.processJob({
      data: { email: 'user@example.com', otp: '123456' },
    });

    expect(sendChallengeEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      otp: '123456',
    });
  });

  it('is not a pipeline stage (no post_pipeline_runs bookkeeping)', () => {
    const { processor } = build();
    expect(processor.pipelineStage({ data: {} })).toBeNull();
  });
});
