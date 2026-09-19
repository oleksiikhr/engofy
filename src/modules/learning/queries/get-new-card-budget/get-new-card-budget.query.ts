import { Query } from '@nestjs/cqrs';

export class GetNewCardBudgetQuery extends Query<number> {
  constructor(readonly userId: string) {
    super();
  }
}
