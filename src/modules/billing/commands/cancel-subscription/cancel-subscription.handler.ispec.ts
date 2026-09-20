import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { BillingModule } from '../../billing.module.js';
import { Subscription } from '../../entities/subscription.entity.js';
import { SubscriptionPlan } from '../../enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../enums/subscription-status.enum.js';
import { GetSubscriptionQuery } from '../../queries/get-subscription/get-subscription.query.js';
import { CancelSubscriptionCommand } from './cancel-subscription.command.js';

describe('CancelSubscriptionHandler', () => {
  const suite = createIntegrationSuite({ imports: [BillingModule] });

  it('ends an active premium subscription immediately', async () => {
    const userId = uuidv7();
    suite.factories.subscription.makeOne({
      userId,
      plan: SubscriptionPlan.Premium,
      status: SubscriptionStatus.Active,
      currentPeriodEnd: DateTime.now().plus({ days: 20 }),
    });
    await suite.orm.em.flush();

    await suite.command(new CancelSubscriptionCommand(userId));

    expect(await suite.query(new GetSubscriptionQuery(userId))).toBeNull();
  });

  it('is a no-op for a user without an active subscription', async () => {
    const userId = uuidv7();

    await expect(
      suite.command(new CancelSubscriptionCommand(userId)),
    ).resolves.toBeUndefined();
    expect(await suite.orm.em.count(Subscription, { userId })).toBe(0);
  });

  it('leaves an already-lapsed period untouched', async () => {
    const userId = uuidv7();
    const lapsedEnd = DateTime.now().minus({ days: 3 });
    suite.factories.subscription.makeOne({
      userId,
      plan: SubscriptionPlan.Premium,
      status: SubscriptionStatus.Active,
      currentPeriodEnd: lapsedEnd,
    });
    await suite.orm.em.flush();

    await suite.command(new CancelSubscriptionCommand(userId));

    const row = await suite.orm.em.findOneOrFail(Subscription, { userId });
    expect(row.currentPeriodEnd.toMillis()).toBe(lapsedEnd.toMillis());
  });
});
