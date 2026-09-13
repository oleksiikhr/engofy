export class CompleteDailyPlanResponseDto {
  // ISO-8601.
  readonly completedAt!: string;

  readonly newCardsToday!: number;

  readonly reviewsToday!: number;
}
