import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AccountDeletionService } from '../../services/account-deletion.service.js';
import { CancelAccountDeletionByTokenCommand } from './cancel-account-deletion-by-token.command.js';

@CommandHandler(CancelAccountDeletionByTokenCommand)
export class CancelAccountDeletionByTokenHandler
  implements ICommandHandler<CancelAccountDeletionByTokenCommand>
{
  constructor(private readonly deletions: AccountDeletionService) {}

  execute({ dto }: CancelAccountDeletionByTokenCommand): Promise<void> {
    return this.deletions.cancelByToken(dto.token);
  }
}
