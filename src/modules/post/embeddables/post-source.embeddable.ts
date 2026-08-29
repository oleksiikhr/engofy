import { Embeddable, Enum, Property } from '@mikro-orm/decorators/legacy';
import { PostSourceFormat } from '../enums/post-source-format.enum.js';

@Embeddable()
export class PostSource {
  @Enum(() => PostSourceFormat)
  format!: PostSourceFormat;

  @Property({ type: 'text' })
  rawText!: string;

  @Property({ type: 'text', nullable: true })
  link?: string | null;
}
