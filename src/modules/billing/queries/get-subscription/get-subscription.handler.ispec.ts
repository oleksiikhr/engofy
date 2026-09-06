import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { BillingModule } from '../../billing.module.js';
import { Subscription } from '../../entities/subscription.entity.js';
import { SubscriptionPlan } from '../../enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../enums/subscription-status.enum.js';
import { GetSubscriptionQuery } from './get-subscription.query.js';

describe('GetSubscriptionHandler', () => {
  const suite = createIntegrationSuite({ imports: [BillingModule] });

  function seedSubscription(userId: string, currentPeriodEnd: DateTime): void {
    suite.orm.em.create(Subscription, {
      userId,
      plan: SubscriptionPlan.Premium,
      status: SubscriptionStatus.Active,
      currentPeriodEnd,
      isMockPayment: true,
    });
  }

  it('returns null for a user with no subscription', async () => {
    const view = await suite.query(new GetSubscriptionQuery(uuidv7()));
    expect(view).toBeNull();
  });

  it('returns a plain view for a running premium period', async () => {
    const userId = uuidv7();
    const end = DateTime.now().plus({ days: 20 });
    seedSubscription(userId, end);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const view = await suite.query(new GetSubscriptionQuery(userId));

    expect(view).not.toBeNull();
    expect(view?.plan).toBe(SubscriptionPlan.Premium);
    expect(view?.isMockPayment).toBe(true);
    expect(
      Math.abs(view?.currentPeriodEnd.diff(end).as('minutes') ?? 99),
    ).toBeLessThan(1);
    // Not a managed entity — no ORM internals leak through the bus.
    expect(view).not.toBeInstanceOf(Subscription);
  });

  it('treats a lapsed period as free tier', async () => {
    const userId = uuidv7();
    seedSubscription(userId, DateTime.now().minus({ days: 1 }));
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const view = await suite.query(new GetSubscriptionQuery(userId));
    expect(view).toBeNull();
  });
});
