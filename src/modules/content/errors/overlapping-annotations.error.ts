import { DomainError } from '../../../core/errors/domain.error.js';

export class OverlappingAnnotationsError extends DomainError {
  constructor(start: number, end: number) {
    super(
      `Annotation [${start}, ${end}) overlaps another annotation in the same batch`,
    );
  }
}
