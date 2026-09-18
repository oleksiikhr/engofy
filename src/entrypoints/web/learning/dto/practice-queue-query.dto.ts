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
  // The "Show N more new" button's bypass — current request only, never
  // persisted (practice-redesign зріз 2). A plain `z.coerce.boolean()` would
  // treat the string `"false"` as truthy, so this matches on the literal
  // values instead.
  bypassNewLimit: queryParam(
    z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true')
      .describe(
        'Skip the daily new-card cap for this request (current session only; the free-tier card cap still applies).',
      ),
  ),
});

export class PracticeQueueQueryDto extends createZodDto(
  PracticeQueueQuerySchema,
) {}
