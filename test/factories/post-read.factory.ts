import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { PostRead } from '../../src/modules/post/entities/post-read.entity.js';

// `userId` and `postId` have no default — pass the parents' ids.
export class PostReadFactory extends Factory<PostRead> {
  readonly model = PostRead;

  protected definition() {
    return { readAt: DateTime.now() };
  }
}
