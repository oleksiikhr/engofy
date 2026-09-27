export class StreakFreezeStatusResponseDto {
  // Remaining freezes this calendar month (0 for Free/guest).
  readonly balance!: number;

  // Whether calling `POST /learning/streak/freeze` right now would succeed.
  readonly applicable!: boolean;
}
