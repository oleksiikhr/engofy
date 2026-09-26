import { Query } from '@nestjs/cqrs';

export class GetDailyNewCardLimitQuery extends Query<number> {
  constructor(readonly userId: string) {
    super();
  }
}
