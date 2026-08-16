import { DomainError } from '../../../core/errors/domain.error.js';

export class InvalidGoogleCredentialError extends DomainError {
  constructor() {
    super('Invalid Google credential');
  }
}
