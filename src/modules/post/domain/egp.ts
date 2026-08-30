import { z } from 'zod';
import { slugify } from '../../../core/helpers/slug.helper.js';
import { CefrLevel } from '../enums/cefr-level.enum.js';

// One row of the Cambridge English Grammar Profile (assets/egp.json). See
// assets/README.md for how the JSON is derived from the source spreadsheet.
export const EgpRecordSchema = z.object({
  index: z.number().int().positive(),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  level: z.enum(CefrLevel),
  guideword: z.string().min(1),
  // A handful of FORM: rows have no can-do statement; USE rows always do.
  can_do: z.string(),
  example: z.string().min(1).nullable(),
});

export type EgpRecord = z.infer<typeof EgpRecordSchema>;

export function parseEgpRecords(raw: unknown): EgpRecord[] {
  return z.array(EgpRecordSchema).min(1).parse(raw);
}

// Only USE / FORM/USE guideword records become grammar_usage_points; every
// other record (FORM:, stray comments) feeds the construction cheat sheet
// (PLAN.md §12).
export function classifyEgpRecord(record: EgpRecord): 'use' | 'form' {
  const g = record.guideword.trim().toUpperCase();
  return g.startsWith('USE') || g.startsWith('FORM/USE') ? 'use' : 'form';
}

// Constructions are keyed by (category, subcategory) — a subcategory name like
// "comparatives" recurs under more than one category, so the slug carries both.
export function grammarConstructionSlug(
  category: string,
  subcategory: string,
): string {
  return slugify(`${category} ${subcategory}`);
}

const GUIDEWORD_PREFIX = /^(FORM\/USE|FORM|USE)\s*:?\s*/i;

// Markdown cheat sheet for a construction, built from its non-USE records
// (grouped input is the caller's job — pass every EGP record for one
// construction). Returns null when there's nothing form-related to show.
export function buildCheatSheet(records: EgpRecord[]): string | null {
  const formRecords = records.filter((r) => classifyEgpRecord(r) === 'form');
  if (formRecords.length === 0) {
    return null;
  }

  const lines = ['## Form', ''];
  for (const r of formRecords) {
    const label = r.guideword.trim().replace(GUIDEWORD_PREFIX, '') || 'Form';
    const canDo = r.can_do.trim();
    lines.push(`- **${label}** — ${r.level}${canDo ? ` — ${canDo}` : ''}`);
  }

  return lines.join('\n');
}
