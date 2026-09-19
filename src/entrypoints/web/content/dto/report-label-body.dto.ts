import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ReportLabelBodySchema = z.object({
  kind: z
    .enum(['word', 'phrase', 'grammar'])
    .describe('Which kind of label is being reported.'),
  targetId: z
    .uuid()
    .describe('wordDefinitionId, phraseId or grammarUsagePointId, per kind.'),
});

export class ReportLabelBodyDto extends createZodDto(ReportLabelBodySchema) {}
