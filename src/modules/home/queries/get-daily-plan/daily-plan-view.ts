import type { DateTime } from 'luxon';
import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';

export interface DailyPlanView {
  postShortId: string;
  postSlug: string | null;
  postTitle: string | null;
  postCefrLevel: CefrLevel | null;
  // Null when the post had no still-unlearned grammar usage point to
  // highlight (SelectDailyPlanCandidateHandler).
  grammarUsagePointId: string | null;
  grammarGuideword: string | null;
  grammarCanDoStatement: string | null;
  // Passive display only (крок 3) — can-do + example, no question. prompt.txt
  // leaves open whether this should later reuse post-detail-redesign's active
  // contrastive question instead; revisit once that plan deploys.
  grammarExampleText: string | null;
  completedAt: DateTime | null;
}
