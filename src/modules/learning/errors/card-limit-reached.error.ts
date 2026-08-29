import { DomainError } from '../../../core/errors/domain.error.js';

// Free tier is capped at 100 learning cards total (PLAN.md §3.5, §8).
export class CardLimitReachedError extends DomainError {
  constructor(limit: number) {
    super(`Free plan is limited to ${limit} cards. Upgrade to add more.`);
  }
}
