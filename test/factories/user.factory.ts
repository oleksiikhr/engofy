import { Factory } from '@mikro-orm/seeder';
import { User } from '../../src/modules/auth/entities/user.entity.js';
import { nextSeq } from './sequence.js';

export class UserFactory extends Factory<User> {
  readonly model = User;

  protected definition() {
    return { email: `user-${nextSeq('user')}@example.test` };
  }
}
