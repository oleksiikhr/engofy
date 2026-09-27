import { Query } from '@nestjs/cqrs';
import type { StreakFreezeStatus } from '../../services/streak-freeze.service.js';

export class GetStreakFreezeStatusQuery extends Query<StreakFreezeStatus> {
  constructor(readonly userId: string) {
    super();
  }
}
