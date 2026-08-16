import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LoginWithGoogleSchema = z.object({
  credential: z.string().min(16),
});

export class LoginWithGoogleDto extends createZodDto(LoginWithGoogleSchema) {}
