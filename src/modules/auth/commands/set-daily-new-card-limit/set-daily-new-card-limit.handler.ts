import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../entities/user.entity.js';
import { SetDailyNewCardLimitCommand } from './set-daily-new-card-limit.command.js';

@CommandHandler(SetDailyNewCardLimitCommand)
export class SetDailyNewCardLimitHandler
  implements ICommandHandler<SetDailyNewCardLimitCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    dailyNewCardLimit,
  }: SetDailyNewCardLimitCommand): Promise<number> {
    const user = await this.em.findOneOrFail(User, { id: userId });
    user.dailyNewCardLimitOverride = dailyNewCardLimit;

    return user.dailyNewCardLimitOverride;
  }
}
