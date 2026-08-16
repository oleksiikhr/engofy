import { DomainError } from '../../../core/errors/domain.error.js';

export class InvalidOrExpiredChallengeError extends DomainError {
  constructor() {
    super('Invalid or expired code');
  }
}
