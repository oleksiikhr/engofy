import { DomainError } from '../../../core/errors/domain.error.js';

// The `?cursor=` on `GET /dictionary` failed to decode/verify (tampered,
// stale version, or garbage input) — 400, not a 500.
export class InvalidDictionaryCursorError extends DomainError {}
