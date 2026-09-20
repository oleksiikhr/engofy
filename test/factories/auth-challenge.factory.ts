import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { AuthChallenge } from '../../src/modules/auth/entities/auth-challenge.entity.js';
import { nextSeq } from './sequence.js';

export class AuthChallengeFactory extends Factory<AuthChallenge> {
  readonly model = AuthChallenge;

  protected definition() {
    const n = nextSeq('auth-challenge');

    return {
      email: `challenge-${n}@example.test`,
      otpHash: `otp-hash-${n}`,
      expiresAt: DateTime.now().plus({ minutes: 10 }),
    };
  }
}
