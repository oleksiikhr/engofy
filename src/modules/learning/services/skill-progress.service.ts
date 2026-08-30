import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { GrammarUsagePoint } from '../../post/entities/grammar-usage-point.entity.js';
import type { LearningCard } from '../entities/learning-card.entity.js';
import { UserSkillProgress } from '../entities/user-skill-progress.entity.js';
import type { ReviewRating } from '../enums/review-rating.enum.js';
import { ReviewRating as Rating } from '../enums/review-rating.enum.js';

// Keeps `user_skill_progress` in step with the learner's grammar cards
// (PLAN.md §3.6). A construction is unlocked the moment its first card is
// added; the attempt / streak counters are display-only tallies bumped on each
// grammar review. `masteryScore` is NOT written here — `get-profile` derives it
// from live FSRS card state at read time (D11). Callers flush.
@Injectable()
export class SkillProgressService {
  constructor(private readonly em: EntityManager) {}

  // Called when a grammar card is added. Creates the progress row (and stamps
  // `unlockedAt`) if it does not exist yet; otherwise a no-op.
  async unlockConstruction(
    userId: string,
    grammarUsagePointId: string,
  ): Promise<void> {
    const constructionId = await this.constructionOf(grammarUsagePointId);
    if (constructionId) {
      await this.loadOrCreate(userId, constructionId);
    }
  }

  // Called after a grammar card is graded and rescheduled. Bumps the attempt
  // tallies and recomputes `masteryScore` for the whole construction.
  async recordGrammarReview(
    userId: string,
    card: LearningCard,
    rating: ReviewRating,
  ): Promise<void> {
    if (!card.grammarUsagePointId) {
      return;
    }
    const constructionId = await this.constructionOf(card.grammarUsagePointId);
    if (!constructionId) {
      return;
    }

    const progress = await this.loadOrCreate(userId, constructionId);
    const correct = rating !== Rating.Again;
    progress.totalAttempts = progress.totalAttempts + 1;
    if (correct) {
      progress.correctAttempts = progress.correctAttempts + 1;
      progress.correctStreak = progress.correctStreak + 1;
    } else {
      progress.correctStreak = 0;
    }
  }

  private async constructionOf(
    grammarUsagePointId: string,
  ): Promise<string | null> {
    const point = await this.em.findOne(GrammarUsagePoint, {
      id: grammarUsagePointId,
    });
    return point?.constructionId ?? null;
  }

  // Idempotent under a concurrent first review / add for the same construction:
  // `ON CONFLICT DO NOTHING` re-selects the existing row instead of raising a
  // unique violation on the `(userId, constructionId)` constraint. Commits
  // immediately (M3); any counter bumps by the caller ride the facade flush.
  private async loadOrCreate(
    userId: string,
    constructionId: string,
  ): Promise<UserSkillProgress> {
    return this.em.upsert(
      UserSkillProgress,
      { id: uuidv7(), userId, constructionId, unlockedAt: DateTime.now() },
      {
        onConflictFields: ['userId', 'constructionId'],
        onConflictAction: 'ignore',
      },
    );
  }
}
