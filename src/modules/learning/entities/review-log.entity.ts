import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { ReviewRating } from '../enums/review-rating.enum.js';
import { LearningCard } from './learning-card.entity.js';

// Append-only log of one grade against a LearningCard. Slim subset of ts-fsrs
// ReviewLog — enough to rebuild scheduling history and drive stats.
@Entity({ tableName: 'review_logs' })
export class ReviewLog {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @ManyToOne(() => LearningCard, {
    mapToPk: true,
    fieldName: 'card_id',
    deleteRule: 'cascade',
  })
  @Index()
  cardId!: string;

  @Enum({ items: () => ReviewRating })
  rating!: ReviewRating;

  @Property({ type: LuxonTimestampType })
  reviewedAt!: DateTime;

  @Property({ type: 'integer' })
  elapsedDays!: number;

  @Property({ type: 'integer' })
  scheduledDays!: number;
}
