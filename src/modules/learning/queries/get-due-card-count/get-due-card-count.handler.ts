import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { GetDueCardCountQuery } from './get-due-card-count.query.js';

// Backs the feed's soft "N due" badge (PLAN.md §16/§17 Track B) — a plain
// count, not the practice queue itself, since the feed only needs to know
// whether/how much is due, not the cards. Replaces the forced
// review-every-2–3-posts interstitial from PLAN.md §4, which was never
// actually built.
@QueryHandler(GetDueCardCountQuery)
export class GetDueCardCountHandler
  implements IQueryHandler<GetDueCardCountQuery>
{
  constructor(private readonly em: EntityManager) {}

  execute({ userId }: GetDueCardCountQuery): Promise<number> {
    return this.em.count(LearningCard, {
      userId,
      due: { $lte: DateTime.now() },
    });
  }
}
