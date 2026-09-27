import { DomainError } from '../../../core/errors/domain.error.js';

// The fixed monthly pool (`STREAK_FREEZES_PER_MONTH`) is already spent.
export class StreakFreezeBalanceExhaustedError extends DomainError {
  constructor(allotment: number) {
    super(`You've used all ${allotment} streak freezes for this month.`);
  }
}
