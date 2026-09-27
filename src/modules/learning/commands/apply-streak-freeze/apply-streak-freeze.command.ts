import { Command } from '@nestjs/cqrs';
import type { StreakFreezeApplication } from '../../services/streak-freeze.service.js';

export class ApplyStreakFreezeCommand extends Command<StreakFreezeApplication> {
  constructor(readonly userId: string) {
    super();
  }
}
