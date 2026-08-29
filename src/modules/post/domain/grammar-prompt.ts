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
- Never emit two tags for the exact same span.
- If a shorter construction sits entirely inside a longer one, you may nest the tags: ⟦outer text ⟦inner⟧{{g|inner-slug|11}} more⟧{{g|outer-slug|22}}. Keep nesting to a single level and only where both constructions are genuinely present. Do not make tags partially overlap (one tag's ⟦…⟧ crossing another's boundary without being fully inside it).
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

const INLINE_WS_RE = /\s+/g;
const WS_CHAR_RE = /\s/;

// Collapses every internal whitespace run (newlines included) to a single
// space and trims the ends, returning the normalised text plus a map from
// each normalised char index to its original index (length is
// normalised.length + 1 — the final entry is the exclusive end). spaCy
// sentence spans keep the source's hard-wrap newlines in `rawText`; the
// numbered-line prompt/parse contract assumes one sentence per physical
// line, so the model sees the collapsed form and span offsets are mapped
// back to `rawText` coords afterward (SentenceToken offsets are relative to
// `rawText`).
export function normalizeInlineWhitespace(text: string): {
  normalized: string;
  map: number[];
} {
  let normalized = '';
  const map: number[] = [];
  let i = 0;
  const n = text.length;
  let lastOrigEnd = 0;

  while (i < n && WS_CHAR_RE.test(text[i])) {
    i += 1;
  }
  while (i < n) {
    if (WS_CHAR_RE.test(text[i])) {
      const runStart = i;
      while (i < n && WS_CHAR_RE.test(text[i])) {
        i += 1;
      }
      if (i < n) {
        map.push(runStart);
        normalized += ' ';
      }
    } else {
      map.push(i);
      normalized += text[i];
      lastOrigEnd = i + 1;
      i += 1;
    }
  }
  map.push(lastOrigEnd);

  return { normalized, map };
}

export function buildGrammarUserText(sentenceTexts: string[]): string {
  return sentenceTexts
    .map(
      (text, index) => `[${index}] ${text.replace(INLINE_WS_RE, ' ').trim()}`,
    )
    .join('\n');
}

const NUMBERED_MARKER_RE = /^\[(\d+)]\s?/gm;

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

// Slices the model's numbered output into per-index blocks. Block-based (not
// line-based) so a sentence the model happened to wrap across several
// physical lines is still captured whole — everything from its `[i]` marker
// up to the next marker (or end of output). Later duplicate wins, matching
// the previous Map.set behaviour.
function splitNumberedBlocks(rawOutput: string): Map<number, string> {
  const markers: { index: number; start: number; bodyStart: number }[] = [];
  NUMBERED_MARKER_RE.lastIndex = 0;
  let match: RegExpExecArray | null = NUMBERED_MARKER_RE.exec(rawOutput);
  while (match !== null) {
    markers.push({
      index: Number(match[1]),
      start: match.index,
      bodyStart: match.index + match[0].length,
    });
    match = NUMBERED_MARKER_RE.exec(rawOutput);
  }

  const blocks = new Map<number, string>();
  markers.forEach((marker, i) => {
    const end =
      i + 1 < markers.length ? markers[i + 1].start : rawOutput.length;
    blocks.set(marker.index, rawOutput.slice(marker.bodyStart, end));
  });
  return blocks;
}

// Splits the model's numbered output back into per-sentence tagged blocks and
// runs parseGrammarTags against each sentence. The comparison runs in
// whitespace-normalised space (see normalizeInlineWhitespace); the recovered
// span offsets are mapped back to the original `rawText` so downstream
// SentenceToken mapping stays correct.
export function parseGrammarResponse(
  sentenceTexts: string[],
  rawOutput: string,
): ParsedGrammarResponse {
  const taggedByIndex = splitNumberedBlocks(rawOutput);

  const lines: GrammarLineResult[] = [];
  let isComplete = true;

  sentenceTexts.forEach((sentenceText, index) => {
    const tagged = taggedByIndex.get(index);
    if (tagged === undefined) {
      isComplete = false;
      lines.push({ index, spans: [] });
      return;
    }

    const { normalized, map } = normalizeInlineWhitespace(sentenceText);
    const parsed = parseGrammarTags(
      normalized,
      tagged.replace(INLINE_WS_RE, ' ').trim(),
    );
    if (!parsed.isComplete) {
      isComplete = false;
    }

    const spans = parsed.spans.map((span) => {
      const charStart = map[span.charStart] ?? span.charStart;
      const charEnd = map[span.charEnd] ?? span.charEnd;
      return {
        ...span,
        charStart,
        charEnd,
        form: sentenceText.slice(charStart, charEnd),
      };
    });
    lines.push({ index, spans });
  });

  return { lines, isComplete };
}
