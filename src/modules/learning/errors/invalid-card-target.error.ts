import { DomainError } from '../../../core/errors/domain.error.js';

// A card must point at exactly one of word / phrase / grammar usage point,
// and that target must exist (PLAN.md §3.5).
export class InvalidCardTargetError extends DomainError {}
