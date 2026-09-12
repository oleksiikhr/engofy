import { Query } from '@nestjs/cqrs';

export class GetStreakQuery extends Query<number> {
  constructor(readonly userId: string) {
    super();
  }
}
