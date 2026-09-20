import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { AuthSession } from '../../src/modules/auth/entities/auth-session.entity.js';
import { nextSeq } from './sequence.js';

// `userId` has no default — pass the owning user's id.
export class AuthSessionFactory extends Factory<AuthSession> {
  readonly model = AuthSession;

  protected definition() {
    return {
      tokenHash: `session-token-${nextSeq('auth-session')}`,
      expiresAt: DateTime.now().plus({ days: 1 }),
    };
  }
}
