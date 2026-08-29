import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AddCardSchema = z
  .object({
    wordId: z.uuid().optional().describe('Add a card for this word.'),
    phraseId: z.uuid().optional().describe('Add a card for this phrase.'),
    grammarUsagePointId: z
      .uuid()
      .optional()
      .describe('Add a card for this grammar usage point.'),
  })
  .refine(
    (value) =>
      [value.wordId, value.phraseId, value.grammarUsagePointId].filter(Boolean)
        .length === 1,
    {
      message:
        'Provide exactly one of wordId, phraseId or grammarUsagePointId.',
    },
  );

export class AddCardDto extends createZodDto(AddCardSchema) {}
