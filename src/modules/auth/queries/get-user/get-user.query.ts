import { Query } from '@nestjs/cqrs';
import type { User } from '../../entities/user.entity.js';

export class GetUserQuery extends Query<User> {
  constructor(readonly userId: string) {
    super();
  }
}
