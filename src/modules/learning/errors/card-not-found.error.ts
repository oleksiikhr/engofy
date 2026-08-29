import { DomainError } from '../../../core/errors/domain.error.js';

// The card id in the request does not belong to the current user.
export class CardNotFoundError extends DomainError {
  constructor() {
    super('Card not found');
  }
}
