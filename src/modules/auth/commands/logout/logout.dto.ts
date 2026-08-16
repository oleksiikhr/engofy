import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LogoutSchema = z.object({
  sessionToken: z.string().min(16),
});

export class LogoutDto extends createZodDto(LogoutSchema) {}
