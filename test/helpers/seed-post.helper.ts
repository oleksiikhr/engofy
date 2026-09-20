import type { EntityManager } from '@mikro-orm/postgresql';
import { PostSource } from '../../src/modules/post/embeddables/post-source.embeddable.js';
import { Post } from '../../src/modules/post/entities/post.entity.js';
import { CefrLevel } from '../../src/modules/post/enums/cefr-level.enum.js';
import { PostSourceFormat } from '../../src/modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../src/modules/post/enums/post-status.enum.js';

// A minimal persisted post — the parent row that FK-bearing fixtures
// (`daily_plans`, `post_reads`, …) must point at now that the DB enforces it.
export async function seedPost(em: EntityManager): Promise<Post> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  post.status = PostStatus.Published;
  post.title = 'A post';
  post.cefrLevel = CefrLevel.B1;
  em.persist(post);
  await em.flush();
  return post;
}
