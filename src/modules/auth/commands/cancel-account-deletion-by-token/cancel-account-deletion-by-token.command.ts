import { Command } from '@nestjs/cqrs';
import type { CancelAccountDeletionByTokenDto } from './cancel-account-deletion-by-token.dto.js';

export class CancelAccountDeletionByTokenCommand extends Command<void> {
  constructor(readonly dto: CancelAccountDeletionByTokenDto) {
    super();
  }
}
