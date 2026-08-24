import { DomainError } from '../../../core/errors/domain.error.js';

export class InvalidAnnotationOffsetError extends DomainError {
  constructor(reason: string) {
    super(`Invalid annotation offset: ${reason}`);
  }
}
