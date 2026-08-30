import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ResolveSessionSchema = z.object({
  sessionToken: z.string().min(16),
});

export class ResolveSessionDto extends createZodDto(ResolveSessionSchema) {}
