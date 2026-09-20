import { Factory } from '@mikro-orm/seeder';
import { PostPart } from '../../src/modules/post/entities/post-part.entity.js';
import { PostPartKind } from '../../src/modules/post/enums/post-part-kind.enum.js';
import { nextSeq } from './sequence.js';

// `postId` has no default — pass the owning post's id. `blockIndex` is unique
// per post: the default is a climbing counter so parts made on the same post
// never collide; set it explicitly when a test asserts on block order.
export class PostPartFactory extends Factory<PostPart> {
  readonly model = PostPart;

  protected definition() {
    return {
      blockIndex: nextSeq('post-part'),
      kind: PostPartKind.Paragraph,
      body: { type: 'paragraph' as const, children: [] },
    };
  }
}
