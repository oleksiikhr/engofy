import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';

// One row per (user, post): the article was read to the end and the
// comprehension quiz was submitted, regardless of correctness (PLAN.md §16 —
// never shown to the user as a score). Independent of SRS: submitting the
// quiz never creates a LearningCard. Groundwork for feed dedup (§17 Track B);
// no consumer reads it yet.
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
