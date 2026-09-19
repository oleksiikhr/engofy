import { DomainError } from '../../../core/errors/domain.error.js';

// The `?cursor=` on `GET /content/posts` failed to decode/verify (tampered,
// stale version, or garbage input) — 400, not a 500.
export class InvalidPostsListCursorError extends DomainError {}
