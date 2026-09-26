import { DomainError } from '../../../core/errors/domain.error.js';

// No day-old-enough gap for a freeze to cover right now (streak already
// unbroken, or the gap is more than one day wide).
export class StreakGapNotCoverableError extends DomainError {
  constructor() {
    super('There is no streak gap a freeze can cover right now.');
  }
}
