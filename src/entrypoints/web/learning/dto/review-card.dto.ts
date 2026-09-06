import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ReviewRating } from '../../../../modules/learning/enums/review-rating.enum.js';

const ReviewCardSchema = z.object({
  rating: z.enum(ReviewRating).describe('The learner grade for this review.'),
});

export class ReviewCardDto extends createZodDto(ReviewCardSchema) {}
