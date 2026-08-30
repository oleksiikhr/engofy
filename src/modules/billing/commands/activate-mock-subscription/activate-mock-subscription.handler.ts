import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { Subscription } from '../../entities/subscription.entity.js';
import { SubscriptionPlan } from '../../enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../enums/subscription-status.enum.js';
import {
  type SubscriptionView,
  toSubscriptionView,
} from '../../types/subscription-view.type.js';
import { ActivateMockSubscriptionCommand } from './activate-mock-subscription.command.js';

const PREMIUM_PERIOD = { months: 1 } as const;

// Mock monetization (PLAN.md §8): the /pricing button just writes a premium
// `subscriptions` row, no payment provider. Calling it again while premium is
// still active extends the current period by another month rather than
// stacking rows.
@CommandHandler(ActivateMockSubscriptionCommand)
export class ActivateMockSubscriptionHandler
  implements ICommandHandler<ActivateMockSubscriptionCommand>
{
  private readonly logger = new Logger(ActivateMockSubscriptionHandler.name);

  constructor(private readonly em: EntityManager) {}

  async execute(
    command: ActivateMockSubscriptionCommand,
  ): Promise<SubscriptionView> {
    const { userId } = command;
    const now = DateTime.now();

    const existing = await this.em.findOne(
      Subscription,
      {
        userId,
        plan: SubscriptionPlan.Premium,
        status: SubscriptionStatus.Active,
      },
      { orderBy: { currentPeriodEnd: 'desc' } },
    );

    if (existing) {
      const from =
        existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
      existing.currentPeriodEnd = from.plus(PREMIUM_PERIOD);
      this.logger.log({ userId }, 'mock premium extended');
      return toSubscriptionView(existing);
    }

    const subscription = new Subscription();
    subscription.userId = userId;
    subscription.plan = SubscriptionPlan.Premium;
    subscription.status = SubscriptionStatus.Active;
    subscription.startedAt = now;
    subscription.currentPeriodEnd = now.plus(PREMIUM_PERIOD);
    subscription.isMockPayment = true;
    this.em.persist(subscription);

    this.logger.log({ userId }, 'mock premium activated');
    return toSubscriptionView(subscription);
  }
}
