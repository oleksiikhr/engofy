import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActivateMockSubscriptionCommand } from './commands/activate-mock-subscription/activate-mock-subscription.command.js';
import { GetSubscriptionQuery } from './queries/get-subscription/get-subscription.query.js';
import type { SubscriptionView } from './types/subscription-view.type.js';

@Injectable()
export class BillingService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async activateMockSubscription(userId: string): Promise<SubscriptionView> {
    const subscription = await this.commandBus.execute(
      new ActivateMockSubscriptionCommand(userId),
    );

    await this.em.flush();

    return subscription;
  }

  getActiveSubscription(userId: string): Promise<SubscriptionView | null> {
    return this.queryBus.execute(new GetSubscriptionQuery(userId));
  }

  async isPremium(userId: string): Promise<boolean> {
    return (await this.getActiveSubscription(userId)) !== null;
  }
}
