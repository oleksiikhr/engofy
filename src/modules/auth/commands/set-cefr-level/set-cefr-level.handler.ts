import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { User } from '../../entities/user.entity.js';
import { SetCefrLevelCommand } from './set-cefr-level.command.js';

@CommandHandler(SetCefrLevelCommand)
export class SetCefrLevelHandler
  implements ICommandHandler<SetCefrLevelCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    cefrLevel,
  }: SetCefrLevelCommand): Promise<CefrLevel> {
    const user = await this.em.findOneOrFail(User, { id: userId });
    user.cefrLevel = cefrLevel;

    return user.cefrLevel;
  }
}
