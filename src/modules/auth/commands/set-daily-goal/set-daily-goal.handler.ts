import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../entities/user.entity.js';
import { SetDailyGoalCommand } from './set-daily-goal.command.js';

@CommandHandler(SetDailyGoalCommand)
export class SetDailyGoalHandler
  implements ICommandHandler<SetDailyGoalCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({ userId, dailyGoal }: SetDailyGoalCommand): Promise<number> {
    const user = await this.em.findOneOrFail(User, { id: userId });
    user.dailyGoal = dailyGoal;

    return user.dailyGoal;
  }
}
