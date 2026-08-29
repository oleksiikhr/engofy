import { Command } from '@nestjs/cqrs';
import type { LearningCard } from '../../entities/learning-card.entity.js';
import type { ReviewRating } from '../../enums/review-rating.enum.js';

export class ReviewCardCommand extends Command<LearningCard> {
  constructor(
    readonly userId: string,
    readonly cardId: string,
    readonly rating: ReviewRating,
  ) {
    super();
  }
}
