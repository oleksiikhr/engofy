import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import type { AccountDeletionResponseDto } from './account-deletion-response.dto.js';

export class ProfileHubResponseDto {
  // Consecutive UTC days with at least one review, ending today or yesterday.
  readonly streak!: number;

  // The learner's own self-reported level (`users.cefr_level`), changeable
  // via `PATCH /profile/cefr-level`. The hub owns display + editing of this
  // (profile-hub-redesign slice 3); `/profile/progress` doesn't repeat it.
  readonly cefrLevel!: CefrLevel;

  // Cards per UTC day the learner aims to review (`users.daily_goal`),
  // changeable via `PATCH /profile/daily-goal`.
  readonly dailyGoal!: number;

  // Pending account-deletion request, or null. Drives the hub's cancel banner.
  readonly accountDeletion!: AccountDeletionResponseDto | null;

  // When today's daily-plan session was completed (ISO), or null while it's
  // still open or hasn't been started today.
  readonly dailyPlanCompletedAt!: string | null;
}
