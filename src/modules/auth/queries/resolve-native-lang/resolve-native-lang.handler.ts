import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  ContentLanguage,
  DEFAULT_CONTENT_LANGUAGE,
} from '../../../post/enums/content-language.enum.js';
import { User } from '../../entities/user.entity.js';
import { ResolveNativeLangQuery } from './resolve-native-lang.query.js';

@QueryHandler(ResolveNativeLangQuery)
export class ResolveNativeLangHandler
  implements IQueryHandler<ResolveNativeLangQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    cookieValue,
  }: ResolveNativeLangQuery): Promise<ContentLanguage> {
    if (userId) {
      const user = await this.em.findOne(
        User,
        { id: userId },
        { fields: ['nativeLang'], disableIdentityMap: true },
      );
      if (user) {
        return user.nativeLang;
      }
    }

    return (
      Object.values(ContentLanguage).find((lang) => lang === cookieValue) ??
      DEFAULT_CONTENT_LANGUAGE
    );
  }
}
