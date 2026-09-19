import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';

const CARD_TYPES = ['word', 'phrase', 'grammar'] as const;
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
  // Comma-separated card types (the /practice filter chips); omitted = all.
  types: queryParam(
    z
      .string()
      .transform((value) => value.split(',').filter(Boolean))
      .pipe(z.array(z.enum(CARD_TYPES)).min(1))
      .optional()
      .describe(
        'Comma-separated card types to include: word, phrase, grammar. Omit for all.',
      ),
  ),
});

export class PracticeQueueQueryDto extends createZodDto(
  PracticeQueueQuerySchema,
) {}
