import { Query } from '@nestjs/cqrs';

export class GetDueCardCountQuery extends Query<number> {
  constructor(readonly userId: string) {
    super();
  }
}
