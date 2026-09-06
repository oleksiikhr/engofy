import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const PracticeQueueQuerySchema = z.object({
  limit: queryParam(
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(DEFAULT_LIMIT)
      .describe('Maximum number of due cards to return.'),
  ),
});

export class PracticeQueueQueryDto extends createZodDto(
  PracticeQueueQuerySchema,
) {}
