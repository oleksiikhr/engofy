import { DomainError } from '../../../core/errors/domain.error.js';

export class InvalidNodeTreeError extends DomainError {
  constructor(reason: string) {
    super(`Invalid node tree: ${reason}`);
  }
}
