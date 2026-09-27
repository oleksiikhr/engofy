import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';

export const CARD_TYPES = ['word', 'phrase', 'grammar'] as const;

// Comma-separated card types (the /practice filter chips); shared by every
// endpoint that can be narrowed the same way. Omitted = all.
export const cardTypesQueryParam = queryParam(
  z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(CARD_TYPES)).min(1))
    .optional()
    .describe(
      'Comma-separated card types to include: word, phrase, grammar. Omit for all.',
    ),
);
