import type { EventSubscriber, FlushEventArgs } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { OutboxSenderService } from './outbox-sender.service.js';

@Injectable()
export class OutboxSubscriber implements EventSubscriber, OnModuleInit {
  constructor(
    private readonly orm: MikroORM,
    private readonly outbox: OutboxSenderService,
  ) {}

  onModuleInit(): void {
    this.orm.em.getEventManager().registerSubscriber(this);
  }

  async afterFlush({ em }: FlushEventArgs): Promise<void> {
    await this.outbox.drain(em as EntityManager);
  }
}
