import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import {
  cefrRank,
  emptyCefrRecord,
  minCefr,
} from '../../../post/domain/cefr-order.js';
import { GrammarCategory } from '../../../post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { dailyStreakFromUtcDays } from '../../domain/daily-streak.js';
import { aggregateMasteryScore } from '../../domain/mastery.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { UserSkillProgress } from '../../entities/user-skill-progress.entity.js';
import { GetProfileQuery } from './get-profile.query.js';
import type {
  ProfileCategoryView,
  ProfileConstructionView,
  ProfileView,
} from './profile-view.js';

// Backs the `/profile` page (PLAN.md §4): the 19 → 90 grammar skills tree
// with per-construction mastery and locked/unlocked state, the daily review
// streak, and the learner's card count broken down by CEFR level.
@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: GetProfileQuery): Promise<ProfileView> {
    const [categories, constructions, usagePoints, progress, cards] =
      await Promise.all([
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
        this.em.find(
          UserSkillProgress,
          { userId },
          { disableIdentityMap: true },
        ),
        this.em.find(LearningCard, { userId }, { disableIdentityMap: true }),
      ]);

    const [streak, cefr] = await Promise.all([
      this.computeStreak(cards.map((card) => card.id)),
      this.computeCefrBreakdown(cards, usagePoints),
    ]);

    return {
      streak,
      cefr,
      categories: buildSkillTree(
        categories,
        constructions,
        usagePoints,
        progress,
        cards,
      ),
    };
  }

  // Distinct UTC review days pushed to SQL — avoids loading every `review_logs`
  // row for the user just to bucket them by day.
  private async computeStreak(cardIds: string[]): Promise<number> {
    if (cardIds.length === 0) {
      return 0;
    }
    const placeholders = cardIds.map(() => '?').join(', ');
    const rows = await this.em.getConnection().execute<{ day: string }[]>(
      `SELECT DISTINCT to_char((reviewed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day
           FROM review_logs
          WHERE card_id IN (${placeholders})`,
      cardIds,
      'all',
      this.em.getTransactionContext(),
    );
    return dailyStreakFromUtcDays(
      rows.map((row) => row.day),
      DateTime.now(),
    );
  }

  private async computeCefrBreakdown(
    cards: LearningCard[],
    usagePoints: GrammarUsagePoint[],
  ): Promise<Record<CefrLevel, number>> {
    const breakdown = emptyCefrRecord();
    const pointLevel = new Map(
      usagePoints.map((point) => [point.id, point.cefrLevel]),
    );
    const [wordLevel, phraseLevel] = await Promise.all([
      this.loadWordLevels(cards),
      this.loadPhraseLevels(cards),
    ]);

    for (const card of cards) {
      const level = cardCefrLevel(card, pointLevel, wordLevel, phraseLevel);
      if (level) {
        breakdown[level] += 1;
      }
    }
    return breakdown;
  }

  private async loadWordLevels(
    cards: LearningCard[],
  ): Promise<Map<string, CefrLevel>> {
    const wordIds = unique(cards.map((card) => card.wordId));
    if (wordIds.length === 0) {
      return new Map();
    }
    const definitions = await this.em.find(
      WordDefinition,
      { wordId: { $in: wordIds }, cefrLevel: { $ne: null } },
      { disableIdentityMap: true },
    );
    const levels = new Map<string, CefrLevel>();
    for (const definition of definitions) {
      const level = definition.cefrLevel;
      if (!level) {
        continue;
      }
      const current = levels.get(definition.wordId);
      if (!current || cefrRank(level) < cefrRank(current)) {
        levels.set(definition.wordId, level);
      }
    }
    return levels;
  }

  private async loadPhraseLevels(
    cards: LearningCard[],
  ): Promise<Map<string, CefrLevel>> {
    const phraseIds = unique(cards.map((card) => card.phraseId));
    if (phraseIds.length === 0) {
      return new Map();
    }
    const phrases = await this.em.find(
      Phrase,
      { id: { $in: phraseIds } },
      { disableIdentityMap: true },
    );
    const levels = new Map<string, CefrLevel>();
    for (const phrase of phrases) {
      if (phrase.cefrLevel) {
        levels.set(phrase.id, phrase.cefrLevel);
      }
    }
    return levels;
  }
}

function buildSkillTree(
  categories: GrammarCategory[],
  constructions: GrammarConstruction[],
  usagePoints: GrammarUsagePoint[],
  progress: UserSkillProgress[],
  cards: LearningCard[],
): ProfileCategoryView[] {
  const pointsByConstruction = groupBy(
    usagePoints,
    (point) => point.constructionId,
  );
  const constructionsByCategory = groupBy(
    constructions,
    (construction) => construction.categoryId,
  );
  const progressByConstruction = new Map(
    progress.map((row) => [row.constructionId, row]),
  );
  const grammarCardsByPoint = groupBy(
    cards.filter((card) => card.grammarUsagePointId),
    (card) => card.grammarUsagePointId as string,
  );

  return categories.map((category) => ({
    name: category.name,
    constructions: (constructionsByCategory.get(category.id) ?? []).map(
      (construction) =>
        toConstructionView(
          construction,
          pointsByConstruction.get(construction.id) ?? [],
          progressByConstruction.get(construction.id),
          grammarCardsByPoint,
        ),
    ),
  }));
}

function toConstructionView(
  construction: GrammarConstruction,
  points: GrammarUsagePoint[],
  progress: UserSkillProgress | undefined,
  grammarCardsByPoint: Map<string, LearningCard[]>,
): ProfileConstructionView {
  // Derived at read time from the learner's FSRS card state (D11) — the stored
  // `user_skill_progress.mastery_score` column is no longer maintained.
  const constructionCards = points.flatMap(
    (point) => grammarCardsByPoint.get(point.id) ?? [],
  );
  return {
    slug: construction.slug,
    name: construction.name,
    cefrLevel: minCefr(points.map((point) => point.cefrLevel)),
    locked: !progress?.unlockedAt,
    masteryScore: aggregateMasteryScore(constructionCards),
    correctStreak: progress?.correctStreak ?? 0,
  };
}

function cardCefrLevel(
  card: LearningCard,
  pointLevel: Map<string, CefrLevel>,
  wordLevel: Map<string, CefrLevel>,
  phraseLevel: Map<string, CefrLevel>,
): CefrLevel | null {
  if (card.grammarUsagePointId) {
    return pointLevel.get(card.grammarUsagePointId) ?? null;
  }
  if (card.wordId) {
    return wordLevel.get(card.wordId) ?? null;
  }
  if (card.phraseId) {
    return phraseLevel.get(card.phraseId) ?? null;
  }
  return null;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const bucket = groups.get(key(item));
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key(item), [item]);
    }
  }
  return groups;
}

function unique(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => !!id))];
}
