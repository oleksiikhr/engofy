import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';
import { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Mirrors `EffectiveState` (learning-foundation §2) minus `new` — no saved
// dictionary entry can be in that state (see `GetDictionaryHandler`).
const DictionaryQuerySchema = z.object({
  state: queryParam(
    z
      .enum(EffectiveState)
      // `.exclude()` takes enum *keys*, not values (zod v4 `ZodEnum.exclude`).
      .exclude(['New'])
      .optional()
      .describe('Restrict to one effective state. Omit for every state.'),
  ),
  search: queryParam(
    z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe('Case-insensitive substring match on lemma / phrase text.'),
  ),
  cursor: queryParam(z.string().optional().describe('From `nextCursor`.')),
  limit: queryParam(
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(DEFAULT_LIMIT)
      .describe('How many dictionary entries to return.'),
  ),
});

export class DictionaryQueryDto extends createZodDto(DictionaryQuerySchema) {}
