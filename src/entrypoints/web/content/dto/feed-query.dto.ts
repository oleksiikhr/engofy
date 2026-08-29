import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const FeedQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe('How many feed items to return.'),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('How many feed items to skip (from `nextOffset`).'),
});

export class FeedQueryDto extends createZodDto(FeedQuerySchema) {}
