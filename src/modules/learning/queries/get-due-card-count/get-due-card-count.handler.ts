import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import type { CardTargetType } from '../../domain/card-target.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { GetDueCardCountQuery } from './get-due-card-count.query.js';

function typeFilter(type: CardTargetType): FilterQuery<LearningCard> {
  switch (type) {
    case 'word':
      return { wordDefinitionId: { $ne: null } };
    case 'phrase':
      return { phraseId: { $ne: null } };
    case 'grammar':
      return { grammarUsagePointId: { $ne: null } };
  }
}

// Backs the feed's soft "N due" badge (PLAN.md §16/§17 Track B) and the
// /practice header count — a plain count, not the practice queue itself,
// since callers only need to know whether/how much is due, not the cards.
// Replaces the forced review-every-2–3-posts interstitial from PLAN.md §4,
// which was never actually built. `types` narrows it the same way the
// practice queue's own filter chips do — omitted, every due card counts.
@QueryHandler(GetDueCardCountQuery)
export class GetDueCardCountHandler
  implements IQueryHandler<GetDueCardCountQuery>
{
  constructor(private readonly em: EntityManager) {}

  execute({ userId, types }: GetDueCardCountQuery): Promise<number> {
    return this.em.count(LearningCard, {
      userId,
      due: { $lte: DateTime.now() },
      archivedAt: null,
      ...(types && types.length > 0 && { $or: types.map(typeFilter) }),
    });
  }
}
