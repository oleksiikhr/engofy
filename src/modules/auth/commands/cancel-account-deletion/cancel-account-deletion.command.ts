import { Command } from '@nestjs/cqrs';

export class CancelAccountDeletionCommand extends Command<void> {
  constructor(readonly userId: string) {
    super();
  }
}
