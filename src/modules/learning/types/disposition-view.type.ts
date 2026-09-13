import type { LearningDisposition } from '../entities/learning-disposition.entity.js';
import type { Disposition } from '../enums/disposition.enum.js';

// Plain projection of a `learning_dispositions` row returned by
// `SetDisposition` (cqrs.md Q6 — a Command must not hand back a managed entity).
export interface DispositionView {
  id: string;
  disposition: Disposition;
}

export function toDispositionView(row: LearningDisposition): DispositionView {
  return {
    id: row.id,
    disposition: row.disposition,
  };
}
