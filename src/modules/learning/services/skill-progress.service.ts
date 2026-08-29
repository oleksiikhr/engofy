import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { GrammarUsagePoint } from '../../post/entities/grammar-usage-point.entity.js';
import { aggregateMasteryScore } from '../domain/mastery.js';
import { LearningCard } from '../entities/learning-card.entity.js';
import { UserSkillProgress } from '../entities/user-skill-progress.entity.js';
import type { ReviewRating } from '../enums/review-rating.enum.js';
import { ReviewRating as Rating } from '../enums/review-rating.enum.js';

// Keeps `user_skill_progress` in step with the learner's grammar cards
// (PLAN.md §3.6). A construction is unlocked the moment its first card is
// added; `masteryScore` is recomputed from FSRS state on every grammar
// review; the attempt counters are display-only tallies. Callers flush.
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
    progress.masteryScore = await this.computeMastery(userId, constructionId);
  }

  private async constructionOf(
    grammarUsagePointId: string,
  ): Promise<string | null> {
    const point = await this.em.findOne(GrammarUsagePoint, {
      id: grammarUsagePointId,
    });
    return point?.constructionId ?? null;
  }

  private async loadOrCreate(
    userId: string,
    constructionId: string,
  ): Promise<UserSkillProgress> {
    const existing = await this.em.findOne(UserSkillProgress, {
      userId,
      constructionId,
    });
    if (existing) {
      return existing;
    }
    const progress = new UserSkillProgress();
    progress.userId = userId;
    progress.constructionId = constructionId;
    progress.unlockedAt = DateTime.now();
    this.em.persist(progress);
    return progress;
  }

  private async computeMastery(
    userId: string,
    constructionId: string,
  ): Promise<number> {
    const points = await this.em.find(GrammarUsagePoint, { constructionId });
    if (points.length === 0) {
      return 0;
    }
    const cards = await this.em.find(LearningCard, {
      userId,
      grammarUsagePointId: { $in: points.map((point) => point.id) },
    });
    return aggregateMasteryScore(cards);
  }
}
