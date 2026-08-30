import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PostSourceType } from '../../enums/post-source-type.enum.js';
import { PostType } from '../../enums/post-type.enum.js';

const IngestPostSchema = z.object({
  rawText: z.string().min(1),
  title: z.string().min(1).optional(),
  link: z.url().optional(),
  type: z.enum(PostType).default(PostType.Post),
  // Source attribution (PLAN.md §9). `sourceType` defaults to `original`;
  // `attributionText`, when omitted, is derived from the link (or a generic
  // fallback) by the handler so the stored value is never empty.
  sourceType: z.enum(PostSourceType).default(PostSourceType.Original),
  attributionText: z.string().min(1).optional(),
});

export class IngestPostDto extends createZodDto(IngestPostSchema) {}
