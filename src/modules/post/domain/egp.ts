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

// Every EGP example sentence ends with a corpus-provenance tag in parentheses
// — "(Malaysia; A2 WAYSTAGE; 2008; Chinese; Pass)", "(C1 Polish)" — and the
// can-do / example text carries cross-reference markers ("► reported speech")
// and redaction placeholders ("[?]", a lone " ? "). None of that is meaningful
// to a learner, so it is stripped on import (PLAN.md §3.4). Kept here next to
// the other EGP parsing so the harness and the importer clean text the same way.
const CORPUS_TAG_RE =
  /\s*\((?=[^)]*(?:BREAKTHROUGH|WAYSTAGE|THRESHOLD|VANTAGE|EFFECTIVE OPERATIONAL PROFICIENCY|MASTERY|First Certificate|\bA1\b|\bA2\b|\bB1\b|\bB2\b|\bC1\b|\bC2\b))[^()]*\)/g;
const XREF_MARKER_RE = /\s*►[^\n]*/g;
const REDACTION_RE = /\s*\[\?\]|\s+\?(?=\s)/g;

export function cleanEgpText(text: string): string {
  return text
    .replace(CORPUS_TAG_RE, '')
    .replace(XREF_MARKER_RE, '')
    .replace(REDACTION_RE, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// `cleanEgpText` for the nullable example field: a record with no example, or
// one that cleans down to nothing, stores null.
export function cleanEgpExample(example: string | null): string | null {
  return (example && cleanEgpText(example)) || null;
}

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
    const canDo = cleanEgpText(r.can_do);
    lines.push(`- **${label}** — ${r.level}${canDo ? ` — ${canDo}` : ''}`);
  }

  return lines.join('\n');
}
