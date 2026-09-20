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
import { countResolved } from '../../domain/effective-state-priority.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import { GetGrammarConstructionQuery } from './get-grammar-construction.query.js';
import type {
  ConstructionLevelProgressView,
  ConstructionUsagePointView,
  GrammarConstructionView,
} from './grammar-construction-view.js';

// Backs `/grammar/{slug}` (PLAN.md §4): one construction with its cheat sheet
// and its USE points. Returns null for an unknown slug (controller → 404).
@QueryHandler(GetGrammarConstructionQuery)
export class GetGrammarConstructionHandler
  implements IQueryHandler<GetGrammarConstructionQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    slug,
    userId,
  }: GetGrammarConstructionQuery): Promise<GrammarConstructionView | null> {
    const construction = await this.em.findOne(
      GrammarConstruction,
      { slug },
      { disableIdentityMap: true },
    );
    if (!construction) {
      return null;
    }

    const [category, points] = await Promise.all([
      this.em.findOne(
        GrammarCategory,
        { id: construction.categoryId },
        { disableIdentityMap: true },
      ),
      this.em.find(
        GrammarUsagePoint,
        { constructionId: construction.id },
        { disableIdentityMap: true },
      ),
    ]);

    const sorted = [...points].sort(
      (a, b) => cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel),
    );

    const { stateByPoint, userCefrLevel } = await this.resolvePointStates(
      sorted,
      userId,
    );

    const usagePoints: ConstructionUsagePointView[] = sorted.map((point) => {
      const state = stateByPoint.get(point.id) ?? EffectiveState.New;
      return {
        grammarUsagePointId: point.id,
        cefrLevel: point.cefrLevel,
        guideword: point.guideword,
        canDoStatement: point.canDoStatement,
        explanation: point.learnerExplanation ?? null,
        examples: point.learnerExamples ?? [],
        state,
        // Untouched but at or below the learner's own level — shown as
        // "Assumed known", never counted as learned.
        assumedKnown:
          state === EffectiveState.New &&
          userCefrLevel !== null &&
          cefrRank(point.cefrLevel) <= cefrRank(userCefrLevel),
      };
    });

    return {
      slug: construction.slug,
      name: construction.name,
      categoryName: category?.name ?? '',
      cheatSheetContent: construction.cheatSheetContent ?? null,
      cefrLevel: sorted[0]?.cefrLevel ?? null,
      usagePoints,
      levelProgress: userId
        ? buildLevelProgress(sorted, stateByPoint)
        : undefined,
    };
  }

  // Per usage point, not collapsed to one construction-level value (unlike
  // the reference list) — each point's own "+ Add to deck" button gates on
  // its own state. From the learner's own cards/dispositions only (no CEFR
  // default; the caller derives "assumed known" from `userCefrLevel`). A guest
  // (userId null) gets every point New, no DB join.
  private async resolvePointStates(
    points: GrammarUsagePoint[],
    userId: string | null,
  ): Promise<{
    stateByPoint: Map<string, EffectiveState>;
    userCefrLevel: CefrLevel | null;
  }> {
    const stateByPoint = new Map<string, EffectiveState>();
    if (!userId || points.length === 0) {
      return { stateByPoint, userCefrLevel: null };
    }

    const pointIds = points.map((point) => point.id);
    const [user, cards, dispositions] = await Promise.all([
      this.em.findOneOrFail(User, { id: userId }, { disableIdentityMap: true }),
      this.em.find(
        LearningCard,
        { userId, grammarUsagePointId: { $in: pointIds }, archivedAt: null },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningDisposition,
        { userId, grammarUsagePointId: { $in: pointIds } },
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

    for (const point of points) {
      const card = cardByPoint.get(point.id);
      stateByPoint.set(
        point.id,
        resolveEffectiveState({
          card: card
            ? { state: card.state, scheduledDays: card.scheduledDays }
            : null,
          disposition: dispositionByPoint.get(point.id) ?? null,
        }),
      );
    }

    return { stateByPoint, userCefrLevel: user.cefrLevel };
  }
}

// Resolved / total usage points per CEFR level, easiest first (`points` is
// already sorted by level).
function buildLevelProgress(
  points: GrammarUsagePoint[],
  stateByPoint: Map<string, EffectiveState>,
): ConstructionLevelProgressView[] {
  const byLevel = new Map<CefrLevel, EffectiveState[]>();
  for (const point of points) {
    const states = byLevel.get(point.cefrLevel) ?? [];
    states.push(stateByPoint.get(point.id) ?? EffectiveState.New);
    byLevel.set(point.cefrLevel, states);
  }
  return [...byLevel].map(([cefrLevel, states]) => ({
    cefrLevel,
    learnedCount: countResolved(states),
    totalCount: states.length,
  }));
}
