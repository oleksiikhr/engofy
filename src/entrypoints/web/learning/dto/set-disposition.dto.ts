import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Disposition } from '../../../../modules/learning/enums/disposition.enum.js';

const SetDispositionSchema = z
  .object({
    wordDefinitionId: z
      .uuid()
      .optional()
      .describe('Set a disposition for this word definition.'),
    phraseId: z
      .uuid()
      .optional()
      .describe('Set a disposition for this phrase.'),
    grammarUsagePointId: z
      .uuid()
      .optional()
      .describe('Set a disposition for this grammar usage point.'),
    disposition: z
      .enum(Disposition)
      .describe('Whether the learner already knows or wants to skip this.'),
  })
  .refine(
    (value) =>
      [
        value.wordDefinitionId,
        value.phraseId,
        value.grammarUsagePointId,
      ].filter(Boolean).length === 1,
    {
      message:
        'Provide exactly one of wordDefinitionId, phraseId or grammarUsagePointId.',
    },
  );

export class SetDispositionDto extends createZodDto(SetDispositionSchema) {}
