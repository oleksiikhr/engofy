import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';

// One row per (user, post): the reader marked the article read (button,
// scrolling to the end, or finishing study mode). Independent of SRS: it never
// creates a LearningCard. Drives the `isRead` flag on the posts list and the
// post detail.
@Entity({ tableName: 'post_reads' })
@Unique({ properties: ['userId', 'postId'] })
export class PostRead {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'uuid' })
  postId!: string;

  @Property({ type: LuxonTimestampType })
  readAt!: DateTime;
}
