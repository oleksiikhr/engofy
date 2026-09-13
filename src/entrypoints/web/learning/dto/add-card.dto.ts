import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AddCardSchema = z
  .object({
    wordDefinitionId: z
      .uuid()
      .optional()
      .describe('Add a card for this word definition.'),
    phraseId: z.uuid().optional().describe('Add a card for this phrase.'),
    grammarUsagePointId: z
      .uuid()
      .optional()
      .describe('Add a card for this grammar usage point.'),
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

export class AddCardDto extends createZodDto(AddCardSchema) {}
