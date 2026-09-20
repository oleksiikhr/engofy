import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  EffectiveState,
  resolveEffectiveState,
} from '../../../learning/domain/resolve-effective-state.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../../learning/entities/learning-disposition.entity.js';
import { cefrRank } from '../../domain/cefr-order.js';
import {
  collapseConstructionState,
  countResolved,
} from '../../domain/effective-state-priority.js';
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

    const progressByConstruction = await this.resolveConstructionProgress(
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
        progressByConstruction,
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
    progressByConstruction: Map<string, ConstructionProgress>,
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
      const progress = progressByConstruction.get(construction.id);
      views.push({
        slug: construction.slug,
        name: construction.name,
        cefrLevel: easiestLevel(points),
        usagePointCount: points.length,
        summary: easiestPoint(points)?.learnerExplanation ?? null,
        state: progress?.state ?? EffectiveState.New,
        learnedCount: progress?.learnedCount,
      });
    }
    return views;
  }

  // One collapsed state and resolved-point count per construction, from the
  // learner's own cards and dispositions only — the CEFR default is not
  // applied, so a below-level point stays New until they act on it. A guest
  // (userId null) gets an empty map: every construction New, no DB join.
  private async resolveConstructionProgress(
    usagePoints: GrammarUsagePoint[],
    pointsByConstruction: Map<string, GrammarUsagePoint[]>,
    userId: string | null,
  ): Promise<Map<string, ConstructionProgress>> {
    const result = new Map<string, ConstructionProgress>();
    if (!userId || usagePoints.length === 0) {
      return result;
    }

    const usagePointIds = usagePoints.map((point) => point.id);
    const [cards, dispositions] = await Promise.all([
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
        });
      });
      result.set(constructionId, {
        state: collapseConstructionState(states),
        learnedCount: countResolved(states),
      });
    }

    return result;
  }
}

interface ConstructionProgress {
  state: EffectiveState;
  learnedCount: number;
}

function easiestPoint(points: GrammarUsagePoint[]) {
  return [...points].sort(
    (a, b) => cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel),
  )[0];
}

function easiestLevel(points: GrammarUsagePoint[]) {
  return easiestPoint(points)?.cefrLevel ?? null;
}
