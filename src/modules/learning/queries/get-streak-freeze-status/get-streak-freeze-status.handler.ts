import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  StreakFreezeService,
  type StreakFreezeStatus,
} from '../../services/streak-freeze.service.js';
import { GetStreakFreezeStatusQuery } from './get-streak-freeze-status.query.js';

// Backs `GET /learning/streak/freezes` — this month's remaining balance and
// whether a freeze can be applied right now (Premium only; 0/false for
// Free/guest, `StreakFreezeService.status`).
@QueryHandler(GetStreakFreezeStatusQuery)
export class GetStreakFreezeStatusHandler
  implements IQueryHandler<GetStreakFreezeStatusQuery>
{
  constructor(private readonly streakFreeze: StreakFreezeService) {}

  execute({ userId }: GetStreakFreezeStatusQuery): Promise<StreakFreezeStatus> {
    return this.streakFreeze.status(userId);
  }
}
