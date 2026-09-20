import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PostsSitemapPageParamSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .describe('1-based page number from the sitemap index.'),
});

export class PostsSitemapPageParamDto extends createZodDto(
  PostsSitemapPageParamSchema,
) {}
