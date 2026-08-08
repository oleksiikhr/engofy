import type { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import type { PgBoss, SendOptions } from 'pg-boss';
import { fromKysely } from 'pg-boss';
import { PG_BOSS } from './queue.tokens.js';
import { withSentryTrace } from './sentry-trace.js';

/**
 * Sends a job as part of an existing MikroORM transaction (transactional outbox):
 * the insert into pg-boss's job table runs on the same Kysely transaction as the
 * entity writes, so both commit or roll back together.
 */
@Injectable()
export class OutboxSenderService {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  send<T extends object>(
    em: EntityManager,
    name: string,
    data: T,
    options?: SendOptions,
  ): Promise<string | null> {
    return this.boss.send(name, withSentryTrace(data), {
      ...options,
      db: fromKysely(em.getKysely()),
    });
  }
}
