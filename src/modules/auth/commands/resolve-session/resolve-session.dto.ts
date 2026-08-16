import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ResolveSessionSchema = z.object({
  token: z.string(),
});

export class ResolveSessionDto extends createZodDto(ResolveSessionSchema) {}
