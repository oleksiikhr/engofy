import { Factory } from '@mikro-orm/seeder';
import { AccountDeletionRequest } from '../../src/modules/auth/entities/account-deletion-request.entity.js';
import { nextSeq } from './sequence.js';

// `userId` has no default — pass the requesting user's id.
export class AccountDeletionRequestFactory extends Factory<AccountDeletionRequest> {
  readonly model = AccountDeletionRequest;

  protected definition() {
    return { cancelTokenHash: `cancel-token-${nextSeq('deletion-request')}` };
  }
}
