import type { DateTime } from 'luxon';

export interface AccountDeletionView {
  requestedAt: DateTime;
  // When the account will be deleted unless the request is cancelled first.
  scheduledFor: DateTime;
}
