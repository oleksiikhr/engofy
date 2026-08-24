import { Embeddable, Enum, Property } from '@mikro-orm/decorators/legacy';
import { ContentSourceFormat } from '../enums/content-source-format.enum.js';

@Embeddable()
export class ContentSource {
  @Enum(() => ContentSourceFormat)
  format!: ContentSourceFormat;

  @Property({ type: 'text' })
  rawText!: string;

  @Property({ type: 'text', nullable: true })
  link?: string | null;
}
