import { Query } from '@nestjs/cqrs';

export class GetReviewsTodayQuery extends Query<number> {
  constructor(readonly userId: string) {
    super();
  }
}
