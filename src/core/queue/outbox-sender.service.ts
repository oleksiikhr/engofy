import type { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import type { PgBoss, SendOptions } from 'pg-boss';
import { fromKysely } from 'pg-boss';
import { PG_BOSS } from './queue.tokens.js';
import { withSentryTrace } from './sentry-trace.js';

interface PendingSend {
  name: string;
  data: object;
  options?: SendOptions;
}

@Injectable()
export class OutboxSenderService {
  private readonly pending = new WeakMap<EntityManager, PendingSend[]>();

  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  send<T extends object>(
    em: EntityManager,
    name: string,
    data: T,
    options?: SendOptions,
  ): void {
    const list = this.pending.get(em) ?? [];
    list.push({ name, data: withSentryTrace(data), options });
    this.pending.set(em, list);
  }

  async drain(em: EntityManager): Promise<void> {
    const list = this.pending.get(em);
    if (!list?.length) {
      return;
    }
    this.pending.delete(em);

    for (const job of list) {
      // biome-ignore lint/performance/noAwaitInLoops: outbox jobs must be sent in the order they were staged.
      await this.boss.send(job.name, job.data, {
        ...job.options,
        db: fromKysely(em.getKysely()),
      });
    }
  }
}
