import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CancelAccountDeletionByTokenSchema = z.object({
  token: z.string().min(16),
});

export class CancelAccountDeletionByTokenDto extends createZodDto(
  CancelAccountDeletionByTokenSchema,
) {}
