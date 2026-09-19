import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import type { SendAccountDeletionEmailJobData } from '../../../../entrypoints/worker/auth/send-account-deletion-email.processor.js';
import { User } from '../../entities/user.entity.js';
import { AccountDeletionService } from '../../services/account-deletion.service.js';
import type { AccountDeletionView } from '../../types/account-deletion-view.type.js';
import { RequestAccountDeletionCommand } from './request-account-deletion.command.js';

// Idempotent: while a request is already pending it is returned as-is, with
// no second e-mail and no second row.
@CommandHandler(RequestAccountDeletionCommand)
export class RequestAccountDeletionHandler
  implements ICommandHandler<RequestAccountDeletionCommand>
{
  constructor(
    private readonly em: EntityManager,
    private readonly deletions: AccountDeletionService,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute({
    userId,
  }: RequestAccountDeletionCommand): Promise<AccountDeletionView> {
    const existing = await this.deletions.findActive(userId);
    if (existing) {
      return this.deletions.toView(existing);
    }

    const user = await this.em.findOneOrFail(User, { id: userId });
    const { request, cancelToken } = this.deletions.issue(userId);
    const view = this.deletions.toView(request);

    this.outbox.send<SendAccountDeletionEmailJobData>(
      this.em,
      QueueName.AuthAccountDeletionEmail,
      {
        email: user.email,
        cancelToken,
        scheduledFor: view.scheduledFor.toUTC().toISO() ?? '',
      },
    );

    return view;
  }
}
