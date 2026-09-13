import { Command } from '@nestjs/cqrs';
import type { DateTime } from 'luxon';

export class CompleteDailyPlanCommand extends Command<DateTime> {
  constructor(readonly userId: string) {
    super();
  }
}
