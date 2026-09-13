import type { DateTime } from 'luxon';
import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';

export interface DailyPlanView {
  // Internal id — not on the wire DTO, only used to scope зріз 2's due-cards
  // lookup (`HomeService#getDailyPlanCards`) to today's post.
  postId: string;
  postShortId: string;
  postSlug: string | null;
  postTitle: string | null;
  postCefrLevel: CefrLevel | null;
  // Крок 1's completion signal (apps/web, зріз 4) — derived from `post_reads`,
  // not a column on `daily_plans` itself (plan.md: progress isn't duplicated).
  isRead: boolean;
  // Null when the post had no still-unlearned grammar usage point to
  // highlight (SelectDailyPlanCandidateHandler).
  grammarUsagePointId: string | null;
  grammarGuideword: string | null;
  // Null whenever grammarUsagePointId is — lets apps/web link "learn more" to
  // `/grammar/[slug]` (daily-session-home plan, зріз 4) without a second call.
  grammarConstructionSlug: string | null;
  grammarCanDoStatement: string | null;
  // Passive display only (крок 3) — can-do + example, no question. prompt.txt
  // leaves open whether this should later reuse post-detail-redesign's active
  // contrastive question instead; revisit once that plan deploys.
  grammarExampleText: string | null;
  completedAt: DateTime | null;
}
