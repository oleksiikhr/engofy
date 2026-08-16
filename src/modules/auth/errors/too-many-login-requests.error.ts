import { DomainError } from '../../../core/errors/domain.error.js';

export class TooManyLoginRequestsError extends DomainError {
  constructor() {
    super('Too many login requests, please try again later');
  }
}
