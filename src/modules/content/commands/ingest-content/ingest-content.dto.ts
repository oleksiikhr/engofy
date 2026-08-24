import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const IngestContentSchema = z.object({
  rawText: z.string().min(1),
  title: z.string().min(1).optional(),
  link: z.url().optional(),
});

export class IngestContentDto extends createZodDto(IngestContentSchema) {}
