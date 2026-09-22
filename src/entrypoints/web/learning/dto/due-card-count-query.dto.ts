import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { cardTypesQueryParam } from './card-types-query.schema.js';

const DueCardCountQuerySchema = z.object({
  types: cardTypesQueryParam,
});

export class DueCardCountQueryDto extends createZodDto(
  DueCardCountQuerySchema,
) {}
