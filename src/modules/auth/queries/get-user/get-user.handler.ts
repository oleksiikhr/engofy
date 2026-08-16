import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../entities/user.entity.js';
import { GetUserQuery } from './get-user.query.js';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(private readonly em: EntityManager) {}

  execute(query: GetUserQuery): Promise<User> {
    return this.em.findOneOrFail(
      User,
      { id: query.userId },
      { disableIdentityMap: true },
    );
  }
}
