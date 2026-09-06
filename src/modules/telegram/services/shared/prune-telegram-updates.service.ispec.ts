import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { TelegramUpdate } from '../../entities/telegram-update.entity.js';
import { TelegramModule } from '../../telegram.module.js';
import { PruneTelegramUpdatesService } from './prune-telegram-updates.service.js';

async function seedUpdate(
  em: EntityManager,
  updateId: string,
  createdDaysAgo: number,
): Promise<void> {
  const row = new TelegramUpdate();
  row.updateId = updateId;
  row.rawPayload = { update_id: Number(updateId) };
  row.processed = true;
  em.persist(row);
  await em.flush();

  await em
    .getConnection()
    .execute(
      'update telegram_updates set created_at = ? where id = ?',
      [DateTime.now().minus({ days: createdDaysAgo }).toJSDate(), row.id],
      'run',
      em.getTransactionContext(),
    );
}

describe('PruneTelegramUpdatesService', () => {
  let service: PruneTelegramUpdatesService;

  const suite = createIntegrationSuite({ imports: [TelegramModule] });

  beforeAll(() => {
    service = suite.moduleRef.get(PruneTelegramUpdatesService, {
      strict: false,
    });
  });

  it('deletes rows older than 30 days and keeps newer ones', async () => {
    await seedUpdate(suite.orm.em, '1', 40);
    await seedUpdate(suite.orm.em, '2', 10);
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    const remaining = await suite.orm.em.find(TelegramUpdate, {});
    expect(remaining.map((r) => r.updateId)).toEqual(['2']);
  });

  it('is a no-op when nothing is stale', async () => {
    await seedUpdate(suite.orm.em, '3', 5);
    suite.orm.em.clear();

    await service.run();
    suite.orm.em.clear();

    expect(await suite.orm.em.count(TelegramUpdate, {})).toBe(1);
  });
});
