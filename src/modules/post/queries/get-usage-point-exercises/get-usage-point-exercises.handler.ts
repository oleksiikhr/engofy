import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GrammarUsagePointExercise } from '../../entities/grammar-usage-point-exercise.entity.js';
import { GetUsagePointExercisesQuery } from './get-usage-point-exercises.query.js';
import type { UsagePointExercisesView } from './usage-point-exercises-view.js';

// The reusable exercise pool for one usage point (PLAN.md grammar-usage-
// -point-exercises, slice 3) — seeded by `grammar import-usage-point-
// -exercises` (assets/README.md), distinct from the per-post `Exercise` pool.
// Empty for a usage point not seeded yet, not an error: seeding is rolled out
// gradually, one usage point at a time.
@QueryHandler(GetUsagePointExercisesQuery)
export class GetUsagePointExercisesHandler
  implements IQueryHandler<GetUsagePointExercisesQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    usagePointId,
  }: GetUsagePointExercisesQuery): Promise<UsagePointExercisesView> {
    const exercises = await this.em.find(
      GrammarUsagePointExercise,
      { usagePointId },
      { orderBy: { createdAt: 'asc', id: 'asc' }, disableIdentityMap: true },
    );

    return {
      items: exercises.map((exercise) => ({
        id: exercise.id,
        type: exercise.type,
        payload: exercise.payload,
      })),
    };
  }
}
