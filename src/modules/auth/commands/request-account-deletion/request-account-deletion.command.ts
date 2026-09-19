import { Command } from '@nestjs/cqrs';
import type { AccountDeletionView } from '../../types/account-deletion-view.type.js';

export class RequestAccountDeletionCommand extends Command<AccountDeletionView> {
  constructor(readonly userId: string) {
    super();
  }
}
