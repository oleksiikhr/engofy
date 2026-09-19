import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../../auth/entities/user.entity.js';
import {
  EffectiveState,
  resolveEffectiveState,
} from '../../../learning/domain/resolve-effective-state.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../../learning/entities/learning-disposition.entity.js';
import { cefrRank } from '../../domain/cefr-order.js';
import { mostAdvancedEffectiveState } from '../../domain/effective-state-priority.js';
import { groupConstructions } from '../../domain/grammar-grouping.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import { GetGrammarReferenceQuery } from './get-grammar-reference.query.js';
import type {
  GrammarReferenceConstructionView,
  GrammarReferenceView,
} from './grammar-reference-view.js';

// Backs the `/grammar` reference index (PLAN.md §4): 19 categories → ~90
// constructions, each with its easiest CEFR level and usage-point count. The
// `cefrLevels` filter keeps only constructions that teach something at one of
// those levels; `groupBy` picks the axis the result is grouped on.
@QueryHandler(GetGrammarReferenceQuery)
export class GetGrammarReferenceHandler
  implements IQueryHandler<GetGrammarReferenceQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    options,
    userId,
  }: GetGrammarReferenceQuery): Promise<GrammarReferenceView> {
    const [categories, constructions, usagePoints] = await Promise.all([
      this.em.find(
        GrammarCategory,
        {},
        { orderBy: { sortOrder: 'asc' }, disableIdentityMap: true },
      ),
      this.em.find(
        GrammarConstruction,
        {},
        { orderBy: { sortOrder: 'asc' }, disableIdentityMap: true },
      ),
      this.em.find(GrammarUsagePoint, {}, { disableIdentityMap: true }),
    ]);

    const pointsByConstruction = new Map<string, GrammarUsagePoint[]>();
    for (const point of usagePoints) {
      const list = pointsByConstruction.get(point.constructionId) ?? [];
      list.push(point);
      pointsByConstruction.set(point.constructionId, list);
    }

    const constructionsByCategory = new Map<string, GrammarConstruction[]>();
    for (const construction of constructions) {
      const list = constructionsByCategory.get(construction.categoryId) ?? [];
      list.push(construction);
      constructionsByCategory.set(construction.categoryId, list);
    }

    const stateByConstruction = await this.resolveConstructionStates(
      usagePoints,
      pointsByConstruction,
      userId,
    );

    // Flat, category-then-sort ordered; grouping re-buckets it without
    // touching the set.
    const entries = categories.flatMap((category) =>
      this.buildConstructionViews(
        constructionsByCategory.get(category.id) ?? [],
        pointsByConstruction,
        stateByConstruction,
        options.cefrLevels,
      ).map((construction) => ({
        categoryName: category.name,
        cefrLevel: construction.cefrLevel,
        construction,
      })),
    );

    return {
      groups: groupConstructions(entries, options.groupBy).map((group) => ({
        key: group.key,
        name: group.name,
        constructions: group.items.map((entry) => entry.construction),
      })),
    };
  }

  private buildConstructionViews(
    constructions: GrammarConstruction[],
    pointsByConstruction: Map<string, GrammarUsagePoint[]>,
    stateByConstruction: Map<string, EffectiveState>,
    cefrLevels: CefrLevel[],
  ): GrammarReferenceConstructionView[] {
    const views: GrammarReferenceConstructionView[] = [];
    for (const construction of constructions) {
      const points = pointsByConstruction.get(construction.id) ?? [];
      if (
        cefrLevels.length > 0 &&
        !points.some((point) => cefrLevels.includes(point.cefrLevel))
      ) {
        continue;
      }
      views.push({
        slug: construction.slug,
        name: construction.name,
        cefrLevel: easiestLevel(points),
        usagePointCount: points.length,
        state: stateByConstruction.get(construction.id) ?? EffectiveState.New,
      });
    }
    return views;
  }

  // One collapsed effective state per construction (learning-foundation's
  // 4-state model), "most advanced wins" over its usage points — a guest
  // (userId null) gets every construction New, no DB join.
  private async resolveConstructionStates(
    usagePoints: GrammarUsagePoint[],
    pointsByConstruction: Map<string, GrammarUsagePoint[]>,
    userId: string | null,
  ): Promise<Map<string, EffectiveState>> {
    const result = new Map<string, EffectiveState>();
    if (!userId || usagePoints.length === 0) {
      return result;
    }

    const usagePointIds = usagePoints.map((point) => point.id);
    const [user, cards, dispositions] = await Promise.all([
      this.em.findOneOrFail(User, { id: userId }, { disableIdentityMap: true }),
      this.em.find(
        LearningCard,
        {
          userId,
          grammarUsagePointId: { $in: usagePointIds },
          archivedAt: null,
        },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningDisposition,
        { userId, grammarUsagePointId: { $in: usagePointIds } },
        { disableIdentityMap: true },
      ),
    ]);

    const cardByPoint = new Map(
      cards
        .filter((card) => card.grammarUsagePointId)
        .map((card) => [card.grammarUsagePointId as string, card]),
    );
    const dispositionByPoint = new Map(
      dispositions
        .filter((disposition) => disposition.grammarUsagePointId)
        .map((disposition) => [
          disposition.grammarUsagePointId as string,
          disposition.disposition,
        ]),
    );

    for (const [constructionId, points] of pointsByConstruction) {
      const states = points.map((point) => {
        const card = cardByPoint.get(point.id);
        return resolveEffectiveState({
          card: card
            ? { state: card.state, scheduledDays: card.scheduledDays }
            : null,
          disposition: dispositionByPoint.get(point.id) ?? null,
          targetCefrLevel: point.cefrLevel,
          userCefrLevel: user.cefrLevel,
        });
      });
      result.set(constructionId, mostAdvancedEffectiveState(states));
    }

    return result;
  }
}

function easiestLevel(points: GrammarUsagePoint[]) {
  if (points.length === 0) {
    return null;
  }
  return [...points].sort(
    (a, b) => cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel),
  )[0].cefrLevel;
}
