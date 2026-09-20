import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { ReviewLog } from '../../src/modules/learning/entities/review-log.entity.js';
import { ReviewRating } from '../../src/modules/learning/enums/review-rating.enum.js';

// `cardId` has no default — pass the reviewed card's id.
export class ReviewLogFactory extends Factory<ReviewLog> {
  readonly model = ReviewLog;

  protected definition() {
    return {
      rating: ReviewRating.Good,
      reviewedAt: DateTime.now(),
      elapsedDays: 0,
      scheduledDays: 1,
    };
  }
}
