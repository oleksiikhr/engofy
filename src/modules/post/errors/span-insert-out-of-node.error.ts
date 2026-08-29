import { DomainError } from '../../../core/errors/domain.error.js';

export class SpanInsertOutOfNodeError extends DomainError {
  constructor(start: number, end: number) {
    super(
      `Span insert [${start}, ${end}) does not fall within exactly one existing child node`,
    );
  }
}
