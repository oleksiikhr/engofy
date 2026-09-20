export class StreakResponseDto {
  readonly streak!: number;

  // The learner's daily card goal (`users.daily_goal`).
  readonly dailyGoal!: number;

  // Cards graded since the start of the current UTC day.
  readonly reviewedToday!: number;
}
