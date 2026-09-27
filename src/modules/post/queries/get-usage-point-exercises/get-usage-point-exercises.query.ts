import { Query } from '@nestjs/cqrs';
import type { UsagePointExercisesView } from './usage-point-exercises-view.js';

export class GetUsagePointExercisesQuery extends Query<UsagePointExercisesView> {
  constructor(readonly usagePointId: string) {
    super();
  }
}
