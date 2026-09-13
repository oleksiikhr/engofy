import { Command } from '@nestjs/cqrs';

export class CreateDailyPlanCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly postId: string,
    readonly grammarUsagePointId: string | null,
  ) {
    super();
  }
}
