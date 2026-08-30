import { Command } from '@nestjs/cqrs';
import type { ResolveSessionDto } from './resolve-session.dto.js';

export interface ResolvedSession {
  userId: string;
}

export class ResolveSessionCommand extends Command<ResolvedSession | null> {
  constructor(readonly dto: ResolveSessionDto) {
    super();
  }
}
