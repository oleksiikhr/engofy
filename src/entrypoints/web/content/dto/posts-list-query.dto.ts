import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const PostsListQuerySchema = z.object({
  cefr: queryParam(
    z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((level) => level.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(CefrLevel)).min(1))
      .optional()
      .describe(
        'Comma-separated CEFR levels to filter by (e.g. `A1,A2`). Omit for every level.',
      ),
  ),
  unreadOnly: queryParam(
    z
      .stringbool()
      .optional()
      .default(false)
      .describe(
        'Only posts the current user has not read yet. Ignored for a guest.',
      ),
  ),
  cursor: queryParam(z.string().optional().describe('From `nextCursor`.')),
  limit: queryParam(
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(DEFAULT_LIMIT)
      .describe('How many posts to return.'),
  ),
});

export class PostsListQueryDto extends createZodDto(PostsListQuerySchema) {}
