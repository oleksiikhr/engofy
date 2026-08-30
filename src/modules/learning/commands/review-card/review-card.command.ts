import { Command } from '@nestjs/cqrs';
import type { ReviewRating } from '../../enums/review-rating.enum.js';
import type { CardView } from '../../types/card-view.type.js';

export class ReviewCardCommand extends Command<CardView> {
  constructor(
    readonly userId: string,
    readonly cardId: string,
    readonly rating: ReviewRating,
  ) {
    super();
  }
}
