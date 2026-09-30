import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { ContentLanguage } from '../../../post/enums/content-language.enum.js';
import { User } from '../../entities/user.entity.js';
import { SetNativeLangCommand } from './set-native-lang.command.js';

@CommandHandler(SetNativeLangCommand)
export class SetNativeLangHandler
  implements ICommandHandler<SetNativeLangCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    nativeLang,
  }: SetNativeLangCommand): Promise<ContentLanguage> {
    const user = await this.em.findOneOrFail(User, { id: userId });
    user.nativeLang = nativeLang;

    return user.nativeLang;
  }
}
