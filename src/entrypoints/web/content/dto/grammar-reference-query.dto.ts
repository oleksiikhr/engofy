import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

const GrammarReferenceQuerySchema = z.object({
  cefr: queryParam(
    z
      .enum(CefrLevel)
      .optional()
      .describe('Keep only constructions that teach something at this level.'),
  ),
});

export class GrammarReferenceQueryDto extends createZodDto(
  GrammarReferenceQuerySchema,
) {}
