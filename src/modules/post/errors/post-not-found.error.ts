import { DomainError } from '../../../core/errors/domain.error.js';

export class PostNotFoundError extends DomainError {
  constructor() {
    super('Post not found', 404);
  }
}
