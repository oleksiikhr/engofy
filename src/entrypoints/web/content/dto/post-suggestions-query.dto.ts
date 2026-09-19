import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

const PostSuggestionsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe('Prefix typed so far; matched case-insensitively.'),
  limit: queryParam(
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(DEFAULT_LIMIT)
      .describe('How many suggestions to return.'),
  ),
});

export class PostSuggestionsQueryDto extends createZodDto(
  PostSuggestionsQuerySchema,
) {}
