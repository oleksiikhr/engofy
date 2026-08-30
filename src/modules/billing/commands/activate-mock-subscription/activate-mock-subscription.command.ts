import { Command } from '@nestjs/cqrs';
import type { Subscription } from '../../entities/subscription.entity.js';

export class ActivateMockSubscriptionCommand extends Command<Subscription> {
  constructor(readonly userId: string) {
    super();
  }
}
