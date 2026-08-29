import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PostType } from '../../enums/post-type.enum.js';

const IngestPostSchema = z.object({
  rawText: z.string().min(1),
  title: z.string().min(1).optional(),
  link: z.url().optional(),
  type: z.enum(PostType).default(PostType.Post),
});

export class IngestPostDto extends createZodDto(IngestPostSchema) {}
