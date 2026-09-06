import { DomainError } from '../../../core/errors/domain.error.js';

export class TooManyAttemptsError extends DomainError {
  constructor() {
    super('Too many verification attempts', 429);
  }
}
