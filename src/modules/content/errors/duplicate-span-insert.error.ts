import { DomainError } from '../../../core/errors/domain.error.js';

export class DuplicateSpanInsertError extends DomainError {
  constructor(start: number, end: number) {
    super(
      `Multiple inserts target the same existing span at [${start}, ${end})`,
    );
  }
}
