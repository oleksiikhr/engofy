import { DomainError } from '../../../core/errors/domain.error.js';

export class GrammarConstructionNotFoundError extends DomainError {
  constructor(slug: string) {
    super(`Grammar construction not found: ${slug}`, 404);
  }
}
