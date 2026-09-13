import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class ProfileHubResponseDto {
  // Consecutive UTC days with at least one review, ending today or yesterday.
  readonly streak!: number;

  // The learner's own self-reported level (`users.cefr_level`), changeable
  // via `PATCH /profile/cefr-level`. The hub owns display + editing of this
  // (profile-hub-redesign slice 3); `/profile/progress` doesn't repeat it.
  readonly cefrLevel!: CefrLevel;

  // TODO(profile-hub-redesign slice 1 follow-up): today's daily-plan
  // completion status, once `daily_plans.completed_at`
  // (.claude/plans/daily-session-home.md slice 1) exists on `main`.
}
