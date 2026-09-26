import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../test/setup/int-suite.helper.js';
import { BillingModule } from './billing.module.js';
import { BillingService } from './billing.service.js';
import { PremiumRequiredError } from './errors/premium-required.error.js';

describe('BillingService.assertPremium', () => {
  const suite = createIntegrationSuite({ imports: [BillingModule] });

  let service: BillingService;

  beforeAll(() => {
    service = suite.moduleRef.get(BillingService, { strict: false });
  });

  it('rejects a free user', async () => {
    const userId = (await suite.factories.user.createOne()).id;

    await expect(service.assertPremium(userId)).rejects.toBeInstanceOf(
      PremiumRequiredError,
    );
  });

  it('rejects a user with a lapsed subscription', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    suite.factories.subscription.makeOne({
      userId,
      currentPeriodEnd: DateTime.now().minus({ days: 1 }),
    });
    await suite.orm.em.flush();

    await expect(service.assertPremium(userId)).rejects.toBeInstanceOf(
      PremiumRequiredError,
    );
  });

  it('resolves for an active premium user', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    suite.factories.subscription.makeOne({ userId });
    await suite.orm.em.flush();

    await expect(service.assertPremium(userId)).resolves.toBeUndefined();
  });
});
