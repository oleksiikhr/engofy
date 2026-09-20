import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { Subscription } from '../../src/modules/billing/entities/subscription.entity.js';
import { SubscriptionPlan } from '../../src/modules/billing/enums/subscription-plan.enum.js';

// `userId` has no default — pass the subscriber's id.
export class SubscriptionFactory extends Factory<Subscription> {
  readonly model = Subscription;

  protected definition() {
    return {
      plan: SubscriptionPlan.Premium,
      currentPeriodEnd: DateTime.now().plus({ days: 30 }),
    };
  }
}
