import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { Subscription } from '../../../auth/entities/subscription.entity.js';
import { SubscriptionPlan } from '../../../auth/enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../../auth/enums/subscription-status.enum.js';
import { BillingModule } from '../../billing.module.js';
import { ActivateMockSubscriptionCommand } from './activate-mock-subscription.command.js';

describe('ActivateMockSubscriptionHandler', () => {
  const suite = createIntegrationSuite({ imports: [BillingModule] });

  it('creates a mock premium subscription for a month', async () => {
    const userId = uuidv7();

    const subscription = await suite.command(
      new ActivateMockSubscriptionCommand(userId),
    );

    expect(subscription.plan).toBe(SubscriptionPlan.Premium);
    expect(subscription.status).toBe(SubscriptionStatus.Active);
    expect(subscription.isMockPayment).toBe(true);
    const monthOut = DateTime.now().plus({ months: 1 });
    expect(
      Math.abs(subscription.currentPeriodEnd.diff(monthOut).as('hours')),
    ).toBeLessThan(1);

    expect(await suite.orm.em.count(Subscription, { userId })).toBe(1);
  });

  it('extends the current period instead of stacking rows', async () => {
    const userId = uuidv7();
    const existingEnd = DateTime.now().plus({ days: 10 });
    suite.orm.em.create(Subscription, {
      userId,
      plan: SubscriptionPlan.Premium,
      status: SubscriptionStatus.Active,
      currentPeriodEnd: existingEnd,
      isMockPayment: true,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const subscription = await suite.command(
      new ActivateMockSubscriptionCommand(userId),
    );

    expect(await suite.orm.em.count(Subscription, { userId })).toBe(1);
    const expected = existingEnd.plus({ months: 1 });
    expect(
      Math.abs(subscription.currentPeriodEnd.diff(expected).as('minutes')),
    ).toBeLessThan(1);
  });
});
