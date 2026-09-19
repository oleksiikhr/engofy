import { DomainError } from '../../../core/errors/domain.error.js';

export class AccountDeletionRequestNotFoundError extends DomainError {
  constructor() {
    super('No pending account deletion request', 404);
  }
}
