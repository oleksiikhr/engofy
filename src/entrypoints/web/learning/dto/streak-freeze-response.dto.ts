export class StreakFreezeResponseDto {
  // The streak count now that the freeze covers the gap.
  readonly streak!: number;

  // Remaining freezes this calendar month, after spending this one.
  readonly balance!: number;
}
