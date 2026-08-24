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
    // DI injects the root, request-context-agnostic EntityManager — resolve
    // it to whichever forked em is actually active so this keys the same
    // object drain() later receives via the afterFlush event.
    const context = em.getContext();
    const list = this.pending.get(context) ?? [];

    list.push({ name, data: withSentryTrace(data), options });

    this.pending.set(context, list);
  }

  async drain(em: EntityManager): Promise<void> {
    const context = em.getContext();
    const list = this.pending.get(context);

    if (!list?.length) {
      return;
    }

    this.pending.delete(context);

    for (const job of list) {
      // biome-ignore lint/performance/noAwaitInLoops: outbox jobs must be sent in the order they were staged.
      await this.boss.send(job.name, job.data, {
        ...job.options,
        db: fromKysely(context.getKysely()),
      });
    }
  }
}
