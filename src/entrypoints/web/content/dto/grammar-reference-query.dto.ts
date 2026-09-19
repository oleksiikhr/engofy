import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { queryParam } from '../../../../core/validation/coerce-query.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { GrammarGroupBy } from '../../../../modules/post/enums/grammar-group-by.enum.js';

const GrammarReferenceQuerySchema = z.object({
  cefr: queryParam(
    z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((level) => level.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(CefrLevel)).min(1))
      .optional()
      .describe(
        'Comma-separated CEFR levels (e.g. `A1,A2`): keep only constructions that teach something at any of them. Omit for every level.',
      ),
  ),
  groupBy: queryParam(
    z
      .enum(GrammarGroupBy)
      .default(GrammarGroupBy.Category)
      .describe(
        'Grouping axis: `category` (EGP categories), `time` (Past / Present / Future / Other) or `cefr` (by easiest level).',
      ),
  ),
});

export class GrammarReferenceQueryDto extends createZodDto(
  GrammarReferenceQuerySchema,
) {}
