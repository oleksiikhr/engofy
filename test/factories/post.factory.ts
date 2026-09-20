import { Factory } from '@mikro-orm/seeder';
import { Post } from '../../src/modules/post/entities/post.entity.js';
import { CefrLevel } from '../../src/modules/post/enums/cefr-level.enum.js';
import { PostSourceFormat } from '../../src/modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../src/modules/post/enums/post-status.enum.js';

// A published B1 post; override `status` / `cefrLevel` / `source` per test.
export class PostFactory extends Factory<Post> {
  readonly model = Post;

  protected definition() {
    return {
      source: { format: PostSourceFormat.Text, rawText: 'Some text.' },
      status: PostStatus.Published,
      title: 'A post',
      cefrLevel: CefrLevel.B1,
    };
  }
}
