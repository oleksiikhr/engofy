import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Subscription } from '../auth/entities/subscription.entity.js';
import { ActivateMockSubscriptionCommand } from './commands/activate-mock-subscription/activate-mock-subscription.command.js';
import { SubscriptionService } from './services/subscription.service.js';

@Injectable()
export class BillingService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async activateMockSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.commandBus.execute(
      new ActivateMockSubscriptionCommand(userId),
    );

    await this.em.flush();

    return subscription;
  }

  getActiveSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptions.getActive(userId);
  }

  isPremium(userId: string): Promise<boolean> {
    return this.subscriptions.isPremium(userId);
  }
}
