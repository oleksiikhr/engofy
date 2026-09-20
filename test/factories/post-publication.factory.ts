import { Factory } from '@mikro-orm/seeder';
import { PostPublication } from '../../src/modules/post/entities/post-publication.entity.js';
import { PublicationPlatform } from '../../src/modules/post/enums/publication-platform.enum.js';

// `postId` has no default — pass the owning post's id.
export class PostPublicationFactory extends Factory<PostPublication> {
  readonly model = PostPublication;

  protected definition() {
    return { platform: PublicationPlatform.Telegram };
  }
}
