import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SIX_DIGIT_CODE_PATTERN = /^\d{6}$/;

const VerifyLoginCodeSchema = z.object({
  email: z.email(),
  code: z.string().regex(SIX_DIGIT_CODE_PATTERN, {
    message: 'code must be a 6-digit numeric string',
  }),
});

export class VerifyLoginCodeDto extends createZodDto(VerifyLoginCodeSchema) {}
