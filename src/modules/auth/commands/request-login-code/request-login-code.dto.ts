import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RequestLoginCodeSchema = z.object({
  email: z.email(),
});

export class RequestLoginCodeDto extends createZodDto(RequestLoginCodeSchema) {}
