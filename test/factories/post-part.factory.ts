import { Factory } from '@mikro-orm/seeder';
import { PostPart } from '../../src/modules/post/entities/post-part.entity.js';
import { PostPartKind } from '../../src/modules/post/enums/post-part-kind.enum.js';

// `postId` has no default — pass the owning post's id. `blockIndex` is unique
// per post, so set it explicitly when a post has several parts.
export class PostPartFactory extends Factory<PostPart> {
  readonly model = PostPart;

  protected definition() {
    return {
      blockIndex: 0,
      kind: PostPartKind.Paragraph,
      body: { type: 'paragraph' as const, children: [] },
    };
  }
}
