import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { PostTopic } from '../../../../modules/post/enums/post-topic.enum.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_TERM_LENGTH = 100;

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
  topic: queryParam(
    z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((topic) => topic.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(PostTopic)).min(1))
      .optional()
      .describe(
        'Comma-separated topics to filter by (e.g. `food,travel`). Omit for every topic.',
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
  term: queryParam(
    z
      .string()
      .trim()
      .min(1)
      .max(MAX_TERM_LENGTH)
      .optional()
      .describe(
        'Only posts whose title contains this text, or that contain this word (any form) or phrase; case-insensitive. A word or phrase must match exactly — use a value from `/content/posts/suggestions`.',
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
