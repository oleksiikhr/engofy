import { DomainError } from '../../../core/errors/domain.error.js';

// The annotation stage builds its word / phrasal-verb spans from the
// sentence_tokens the spacy_parse stage writes, so it must run after it.
// The pipeline wiring guarantees the order (spacy_parse fans out to
// annotation on completion); this guards against a manually mis-ordered run
// failing loudly instead of silently annotating nothing.
export class SpacyLayerMissingError extends DomainError {
  constructor(postId: string) {
    super(
      `post ${postId} has no sentences — run the spacy_parse stage before annotation`,
    );
  }
}
