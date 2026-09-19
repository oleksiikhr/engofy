import { Command } from '@nestjs/cqrs';

export class CancelSubscriptionCommand extends Command<void> {
  constructor(readonly userId: string) {
    super();
  }
}
