import { DomainError } from '../../../core/errors/domain.error.js';

export class OverlappingSpanInsertError extends DomainError {
  constructor(start: number, end: number) {
    super(
      `Span insert [${start}, ${end}) overlaps another insert in the same paragraph`,
    );
  }
}
