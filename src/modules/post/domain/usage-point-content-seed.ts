import { z } from 'zod';
import { ContentLanguage } from '../enums/content-language.enum.js';

// Seed format for hand-written usage-point learner content (assets/grammar-
// -usage-point-content.json, see assets/README.md): egpIndex -> the same
// fields the grammar_enrichment stage writes. Content is written by another
// session (no AI call from this codebase) — this schema is the contract that
// session's output must satisfy.

const text = z.string().trim().min(1);

const UsagePointTranslationSchema = z.object({
  explanation: text,
  examples: z.array(text),
});

export const UsagePointContentSeedSchema = z
  .object({
    explanation: text,
    examples: z.array(text).min(2).max(3),
    // Keyed by ContentLanguage; at least one. Each language's `examples`
    // translates `examples` one to one, in the same order.
    translations: z
      .partialRecord(z.enum(ContentLanguage), UsagePointTranslationSchema)
      .refine(
        (t) => Object.keys(t).length > 0,
        'must translate into a language',
      ),
  })
  .superRefine((seed, ctx) => {
    for (const [lang, translation] of Object.entries(seed.translations)) {
      if (translation.examples.length !== seed.examples.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['translations', lang, 'examples'],
          message: 'must translate every example, in order',
        });
      }
    }
  });

export type UsagePointContentSeed = z.infer<typeof UsagePointContentSeedSchema>;

// JSON object keys are always strings — the egpIndex key is validated as a
// positive integer literal, parsed to a number by the importer.
const EGP_INDEX_KEY = z
  .string()
  .regex(/^[1-9]\d*$/, 'must be a positive integer egpIndex');

export const UsagePointContentSeedFileSchema = z.record(
  EGP_INDEX_KEY,
  UsagePointContentSeedSchema,
);

export type UsagePointContentSeedFile = z.infer<
  typeof UsagePointContentSeedFileSchema
>;

export function parseUsagePointContentSeedFile(
  raw: unknown,
): UsagePointContentSeedFile {
  return UsagePointContentSeedFileSchema.parse(raw);
}
