import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class DailyPlanResponseDto {
  readonly postShortId!: string;

  readonly postSlug!: string | null;

  readonly postTitle!: string | null;

  readonly postCefrLevel!: CefrLevel | null;

  // Крок 1 done — apps/web uses this to decide whether to show the "read the
  // post" step or move on to крок 2 (due cards).
  readonly isRead!: boolean;

  readonly grammarUsagePointId!: string | null;

  readonly grammarGuideword!: string | null;

  readonly grammarConstructionSlug!: string | null;

  readonly grammarCanDoStatement!: string | null;

  readonly grammarExampleText!: string | null;

  // ISO-8601, or null while the session is still in progress.
  readonly completedAt!: string | null;
}
