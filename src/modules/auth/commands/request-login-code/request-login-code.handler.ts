import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import type { SendChallengeEmailJobData } from '../../../../entrypoints/worker/auth/send-challenge-email.processor.js';
import { normalizeEmail } from '../../crypto/token.helper.js';
import { TooManyLoginRequestsError } from '../../errors/too-many-login-requests.error.js';
import { ChallengeService } from '../../services/challenge.service.js';
import { RequestLoginCodeCommand } from './request-login-code.command.js';

@CommandHandler(RequestLoginCodeCommand)
export class RequestLoginCodeHandler
  implements ICommandHandler<RequestLoginCodeCommand>
{
  constructor(
    private readonly em: EntityManager,
    private readonly challenges: ChallengeService,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: RequestLoginCodeCommand): Promise<void> {
    const email = normalizeEmail(command.dto.email);

    const allowed = await this.challenges.allowRequest(email);
    if (!allowed) {
      throw new TooManyLoginRequestsError();
    }

    const { otp } = await this.challenges.issue(email);

    this.outbox.send<SendChallengeEmailJobData>(
      this.em,
      QueueName.AuthChallengeEmail,
      { email, otp },
    );
  }
}
