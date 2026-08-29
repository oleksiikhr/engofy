import { z } from 'zod';
import { CefrLevel } from '../enums/cefr-level.enum.js';

// Static reference list (assets/irregular-verbs.json), not a DB table
// (PLAN.md §3.3). The base form links to `words` via `words.lemma`; the
// inflected forms and cefr level stay here for lookup by the annotation /
// spaCy layers (e.g. resolving "went" -> lemma "go").
export const IrregularVerbEntrySchema = z.object({
  base_form: z.string().min(1),
  past_simple: z.array(z.string().min(1)).min(1),
  past_participle: z.array(z.string().min(1)).min(1),
  cefr_level: z.enum(CefrLevel),
});

export type IrregularVerbEntry = z.infer<typeof IrregularVerbEntrySchema>;

const IrregularVerbListSchema = z
  .array(IrregularVerbEntrySchema)
  .min(1)
  .superRefine((entries, ctx) => {
    const seen = new Set<string>();
    for (const [i, entry] of entries.entries()) {
      const key = entry.base_form.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate base_form "${entry.base_form}"`,
          path: [i, 'base_form'],
        });
      }
      seen.add(key);
    }
  });

export function parseIrregularVerbs(raw: unknown): IrregularVerbEntry[] {
  return IrregularVerbListSchema.parse(raw);
}
