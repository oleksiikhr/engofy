import { DomainError } from '../../../core/errors/domain.error.js';

// Thrown when the nlp-service's char offsets don't slice back to the exact
// text it reported. Per PLAN.md §12 (offset-splice / all-or-nothing) this
// fails the whole spacy_parse job rather than writing partial sentences.
export class NlpOffsetMismatchError extends DomainError {
  constructor(reason: string) {
    super(`nlp-service offset mismatch: ${reason}`);
  }
}
