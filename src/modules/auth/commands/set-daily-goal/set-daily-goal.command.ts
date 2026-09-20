import { Command } from '@nestjs/cqrs';

export class SetDailyGoalCommand extends Command<number> {
  constructor(
    readonly userId: string,
    readonly dailyGoal: number,
  ) {
    super();
  }
}
