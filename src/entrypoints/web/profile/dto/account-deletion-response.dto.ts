export class AccountDeletionResponseDto {
  // ISO-8601.
  readonly requestedAt!: string;

  // ISO-8601; the account is deleted at this moment unless cancelled first.
  readonly scheduledFor!: string;
}
