import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AccountDeletionService } from '../../services/account-deletion.service.js';
import { CancelAccountDeletionCommand } from './cancel-account-deletion.command.js';

@CommandHandler(CancelAccountDeletionCommand)
export class CancelAccountDeletionHandler
  implements ICommandHandler<CancelAccountDeletionCommand>
{
  constructor(private readonly deletions: AccountDeletionService) {}

  execute({ userId }: CancelAccountDeletionCommand): Promise<void> {
    return this.deletions.cancelForUser(userId);
  }
}
