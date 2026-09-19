import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { emptyCefrRecord, minCefr } from '../../../post/domain/cefr-order.js';
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
    const [categories, constructions, usagePoints, progress, allCards] =
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

    // Streak reads every card ever reviewed (archived included — removing a
    // card doesn't erase the days it was reviewed on); the CEFR breakdown and
    // skill tree reflect only what the learner is currently, actively
    // learning.
    const activeCards = allCards.filter((card) => !card.archivedAt);

    const [activityDays, cefr] = await Promise.all([
      this.loadActivityDays(allCards.map((card) => card.id)),
      this.computeCefrBreakdown(activeCards, usagePoints),
    ]);

    return {
      streak: dailyStreakFromUtcDays(activityDays, DateTime.now()),
      activityDays,
      cefr,
      categories: buildSkillTree(
        categories,
        constructions,
        usagePoints,
        progress,
        activeCards,
      ),
    };
  }

  // Distinct UTC review days pushed to SQL — avoids loading every `review_logs`
  // row for the user just to bucket them by day. Backs both the streak count
  // and the full day list for the GitHub-style contribution graph
  // (profile-hub-redesign slice 2).
  private async loadActivityDays(cardIds: string[]): Promise<string[]> {
    if (cardIds.length === 0) {
      return [];
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
    return rows.map((row) => row.day).sort();
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
    const wordDefinitionIds = unique(
      cards.map((card) => card.wordDefinitionId),
    );
    if (wordDefinitionIds.length === 0) {
      return new Map();
    }
    const definitions = await this.em.find(
      WordDefinition,
      { id: { $in: wordDefinitionIds }, cefrLevel: { $ne: null } },
      { disableIdentityMap: true },
    );
    const levels = new Map<string, CefrLevel>();
    for (const definition of definitions) {
      if (definition.cefrLevel) {
        levels.set(definition.id, definition.cefrLevel);
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
  if (card.wordDefinitionId) {
    return wordLevel.get(card.wordDefinitionId) ?? null;
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
