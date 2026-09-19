import { Query } from '@nestjs/cqrs';
import type { AccountDeletionView } from '../../types/account-deletion-view.type.js';

export class GetAccountDeletionQuery extends Query<AccountDeletionView | null> {
  constructor(readonly userId: string) {
    super();
  }
}
