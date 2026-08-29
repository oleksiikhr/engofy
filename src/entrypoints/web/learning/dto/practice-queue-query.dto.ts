import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const PracticeQueueQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe('Maximum number of due cards to return.'),
});

export class PracticeQueueQueryDto extends createZodDto(
  PracticeQueueQuerySchema,
) {}
