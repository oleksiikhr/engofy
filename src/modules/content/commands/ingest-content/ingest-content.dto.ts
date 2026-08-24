import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ContentType } from '../../enums/content-type.enum.js';

const IngestContentSchema = z.object({
  rawText: z.string().min(1),
  title: z.string().min(1).optional(),
  link: z.url().optional(),
  type: z.enum(ContentType).default(ContentType.Post),
});

export class IngestContentDto extends createZodDto(IngestContentSchema) {}
