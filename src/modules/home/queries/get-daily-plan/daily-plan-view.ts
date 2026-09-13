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
  completedAt: DateTime | null;
}
