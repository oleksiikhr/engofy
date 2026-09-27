import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { BillingService } from '../../billing/billing.service.js';
import { dailyStreakFromUtcDays } from '../domain/daily-streak.js';
import {
  coverableGapDay,
  STREAK_FREEZES_PER_MONTH,
  streakFreezeBalance,
} from '../domain/streak-freeze.js';
import { LearningCard } from '../entities/learning-card.entity.js';
import { StreakFreeze } from '../entities/streak-freeze.entity.js';
import { StreakFreezeBalanceExhaustedError } from '../errors/streak-freeze-balance-exhausted.error.js';
import { StreakGapNotCoverableError } from '../errors/streak-gap-not-coverable.error.js';

export interface StreakFreezeStatus {
  balance: number;
  coveredDate: string | null;
  applicable: boolean;
}

export interface StreakFreezeApplication {
  coveredDate: string;
  balance: number;
  streak: number;
}

interface StreakFreezeState {
  reviewedDays: string[];
  frozenDays: string[];
  coveredDate: string | null;
  balance: number;
}

@Injectable()
export class StreakFreezeService {
  constructor(
    private readonly em: EntityManager,
    private readonly billing: BillingService,
  ) {}

  async status(
    userId: string,
    now: DateTime = DateTime.now(),
  ): Promise<StreakFreezeStatus> {
    const { balance, coveredDate } = await this.loadState(userId, now);
    return {
      balance,
      coveredDate,
      applicable: balance > 0 && coveredDate !== null,
    };
  }

  // Validates there is a coverable gap and balance left, persists the freeze
  // (caller flushes) and returns the streak as of right after it. Callers on
  // the HTTP path gate Premium themselves (`billing.assertPremium`) before
  // this runs — Free/guest never reach here with a coverable gap anyway,
  // since `loadState` reports none for them.
  async apply(
    userId: string,
    now: DateTime = DateTime.now(),
  ): Promise<StreakFreezeApplication> {
    const { reviewedDays, frozenDays, coveredDate, balance } =
      await this.loadState(userId, now);
    if (!coveredDate) {
      throw new StreakGapNotCoverableError();
    }
    if (balance <= 0) {
      throw new StreakFreezeBalanceExhaustedError(STREAK_FREEZES_PER_MONTH);
    }

    const freeze = new StreakFreeze();
    freeze.userId = userId;
    freeze.coveredDate = coveredDate;
    this.em.persist(freeze);

    return {
      coveredDate,
      balance: balance - 1,
      streak: dailyStreakFromUtcDays(reviewedDays, now, [
        ...frozenDays,
        coveredDate,
      ]),
    };
  }

  // Free/guest never accrue the pool — the monthly allotment is Premium-only,
  // so there is nothing to load and nothing to cover.
  private async loadState(
    userId: string,
    now: DateTime,
  ): Promise<StreakFreezeState> {
    if (!(await this.billing.isPremium(userId))) {
      return {
        reviewedDays: [],
        frozenDays: [],
        coveredDate: null,
        balance: 0,
      };
    }

    const [reviewedDays, frozenDays, usedThisMonth] = await Promise.all([
      this.loadReviewedDays(userId),
      this.loadFrozenDays(userId),
      this.countUsedThisMonth(userId, now),
    ]);
    return {
      reviewedDays,
      frozenDays,
      coveredDate: coverableGapDay(
        new Set(reviewedDays),
        new Set(frozenDays),
        now,
      ),
      balance: streakFreezeBalance(usedThisMonth),
    };
  }

  // Distinct UTC review days, pushed to SQL — same query `get-streak.handler.ts`
  // runs; duplicated rather than shared since the ORM can't express "distinct
  // day" cheaply either way (DP5, `new-card-budget.service.ts`).
  async loadReviewedDays(userId: string): Promise<string[]> {
    const cardIds = (
      await this.em.find(LearningCard, { userId }, { fields: ['id'] })
    ).map((card) => card.id);
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
    return rows.map((row) => row.day);
  }

  async loadFrozenDays(userId: string): Promise<string[]> {
    const rows = await this.em.find(
      StreakFreeze,
      { userId },
      { fields: ['coveredDate'], disableIdentityMap: true },
    );
    return rows.map((row) => row.coveredDate);
  }

  private countUsedThisMonth(userId: string, now: DateTime): Promise<number> {
    const startOfMonth = now.toUTC().startOf('month');
    const startOfNextMonth = startOfMonth.plus({ months: 1 });
    return this.em.count(StreakFreeze, {
      userId,
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
    });
  }
}
