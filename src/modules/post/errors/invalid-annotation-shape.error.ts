import { DomainError } from '../../../core/errors/domain.error.js';

export class InvalidAnnotationShapeError extends DomainError {
  constructor(reason: string) {
    super(`Invalid annotation shape: ${reason}`);
  }
}
