import { DomainError } from '../../../core/errors/domain.error.js';

// Thrown only when zero published posts exist in the whole system (an empty
// environment before any content pipeline run has published anything) — not
// reachable once at least one post is published, since selection falls back
// to "any published post, read or not" before giving up.
export class NoPostAvailableError extends DomainError {
  constructor() {
    super('No published post available', 404);
  }
}
