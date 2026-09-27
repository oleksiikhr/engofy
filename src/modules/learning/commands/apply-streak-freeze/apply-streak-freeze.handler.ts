import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  type StreakFreezeApplication,
  StreakFreezeService,
} from '../../services/streak-freeze.service.js';
import { ApplyStreakFreezeCommand } from './apply-streak-freeze.command.js';

// Premium gate is the caller's job (`billing.assertPremium`, mirrors
// `PATCH /profile/daily-new-card-limit`) — this validates the gap and the
// monthly balance (`StreakFreezeService.apply`).
@CommandHandler(ApplyStreakFreezeCommand)
export class ApplyStreakFreezeHandler
  implements ICommandHandler<ApplyStreakFreezeCommand>
{
  constructor(private readonly streakFreeze: StreakFreezeService) {}

  execute({
    userId,
  }: ApplyStreakFreezeCommand): Promise<StreakFreezeApplication> {
    return this.streakFreeze.apply(userId);
  }
}
