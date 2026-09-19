import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { Subscription } from '../../entities/subscription.entity.js';
import { SubscriptionPlan } from '../../enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../enums/subscription-status.enum.js';
import { CancelSubscriptionCommand } from './cancel-subscription.command.js';

// Ends premium immediately by closing the period: a lapsed subscription is
// derived from `currentPeriodEnd <= now` (see `SubscriptionStatus`), so no
// status is written. Idempotent — a no-op when nothing is active.
@CommandHandler(CancelSubscriptionCommand)
export class CancelSubscriptionHandler
  implements ICommandHandler<CancelSubscriptionCommand>
{
  private readonly logger = new Logger(CancelSubscriptionHandler.name);

  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: CancelSubscriptionCommand): Promise<void> {
    const now = DateTime.now();

    const active = await this.em.find(Subscription, {
      userId,
      plan: SubscriptionPlan.Premium,
      status: SubscriptionStatus.Active,
      currentPeriodEnd: { $gt: now },
    });

    for (const subscription of active) {
      subscription.currentPeriodEnd = now;
    }

    if (active.length > 0) {
      this.logger.log({ userId }, 'premium cancelled');
    }
  }
}
