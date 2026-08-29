import type { CefrLevel } from '../enums/cefr-level.enum.js';
import { type GrammarSpan, parseGrammarTags } from './parse-grammar-tags.js';

export interface GrammarCatalogUsagePoint {
  egpIndex: number;
  cefr: CefrLevel;
  guideword: string;
  canDoStatement: string;
}

export interface GrammarCatalogEntry {
  slug: string;
  name: string;
  usagePoints: GrammarCatalogUsagePoint[];
}

// Static preamble. The construction/usage-point catalogue is appended at
// call time from the DB (buildGrammarCatalog) since it's seeded data, not a
// constant. Reuses the inline-tag mechanism of IDIOM_SYSTEM_PROMPT:
// the model copies each sentence back verbatim, wrapping grammar spans in
// ⟦⟧ and tagging them — offsets are recovered afterward by
// parseGrammarTags, never stated by the model.
export const GRAMMAR_SYSTEM_PROMPT = `You tag the grammar of English sentences for a language-learning app, against a FIXED catalogue of constructions and usage points (given below).

You receive a numbered list of sentences, one per line:
[0] First sentence.
[1] Second sentence.

For EACH line, copy it back out unchanged — same number prefix, same text character for character — and wrap every grammar construction you recognise like this:

[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before that trip.

Rules:
- Tag format: wrap the exact contiguous span in ⟦ ⟧ and put the tag immediately after the closing ⟧, no space: ⟦span⟧{{g|construction-slug|egpIndex}}.
- "construction-slug" MUST be one of the slugs in the catalogue. "egpIndex" MUST be one of the bracketed [numbers] listed under THAT slug — pick the usage point whose meaning fits this sentence. If none of a construction's usage points fit, do not tag it.
- Use exactly two curly braces each side: {{ and }}.
- Only tag spans that are clearly an instance of a catalogued construction. Ordinary present/past simple that carries no notable structure can be left untagged. Do not tag single ordinary content words.
- Spans may overlap across different constructions only if each is genuinely present; never emit two tags for the exact same span.
- Wrap the smallest span that carries the construction (the verb group + its essential markers), not the whole clause, unless the construction genuinely spans the clause (e.g. conditionals).
- Every input line must appear in your output, in order, fully copied. Output ONLY the numbered tagged lines — no preamble, no explanation, no code fence.

CATALOGUE:
`;

export function buildGrammarCatalog(entries: GrammarCatalogEntry[]): string {
  return entries
    .map((entry) => {
      const header = `## ${entry.slug} — ${entry.name}`;
      const points = entry.usagePoints
        .map(
          (up) =>
            `  [${up.egpIndex}] ${up.cefr} ${up.guideword} — ${up.canDoStatement}`,
        )
        .join('\n');
      return `${header}\n${points}`;
    })
    .join('\n');
}

export function buildGrammarUserText(sentenceTexts: string[]): string {
  return sentenceTexts.map((text, index) => `[${index}] ${text}`).join('\n');
}

const LINE_PREFIX_RE = /^\[(\d+)]\s?/;

export interface GrammarLineResult {
  index: number;
  spans: GrammarSpan[];
}

export interface ParsedGrammarResponse {
  lines: GrammarLineResult[];
  // False if any sentence line is missing from the response or fails its
  // own reconstruct-and-compare check — caller retries once, like the
  // annotation stage.
  isComplete: boolean;
}

// Splits the model's numbered output back into per-sentence tagged lines and
// runs parseGrammarTags against each original sentence.
export function parseGrammarResponse(
  sentenceTexts: string[],
  rawOutput: string,
): ParsedGrammarResponse {
  const taggedByIndex = new Map<number, string>();
  for (const rawLine of rawOutput.split('\n')) {
    const prefix = LINE_PREFIX_RE.exec(rawLine);
    if (prefix) {
      taggedByIndex.set(Number(prefix[1]), rawLine.slice(prefix[0].length));
    }
  }

  const lines: GrammarLineResult[] = [];
  let isComplete = true;

  sentenceTexts.forEach((sentenceText, index) => {
    const tagged = taggedByIndex.get(index);
    if (tagged === undefined) {
      isComplete = false;
      lines.push({ index, spans: [] });
      return;
    }
    const parsed = parseGrammarTags(sentenceText, tagged);
    if (!parsed.isComplete) {
      isComplete = false;
    }
    lines.push({ index, spans: parsed.spans });
  });

  return { lines, isComplete };
}
