import { Command } from '@nestjs/cqrs';

export class SetDailyNewCardLimitCommand extends Command<number> {
  constructor(
    readonly userId: string,
    readonly dailyNewCardLimit: number,
  ) {
    super();
  }
}
