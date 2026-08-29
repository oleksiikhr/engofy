export interface GrammarSpan {
  // Exact substring of the sentence the model wrapped.
  form: string;
  // Char offsets of `form` within the sentence text.
  charStart: number;
  charEnd: number;
  // Construction slug (grammar_constructions.slug).
  slug: string;
  // EGP index of the chosen usage point (grammar_usage_points.egp_index),
  // or null when the model tagged only the construction.
  egpIndex: number | null;
}

export interface ParseGrammarTagsResult {
  spans: GrammarSpan[];
  // Same contract as parseAnnotationTags.isComplete: false when the raw
  // output, with every recognised tag stripped back to its underlying text,
  // does not reconstruct `text` character-for-character, or when a tag
  // couldn't be located in `text`. The caller retries once on false.
  isComplete: boolean;
}

// ⟦span text⟧{{g|construction-slug|egpIndex}} — egpIndex optional:
// ⟦span⟧{{g|slug}} is accepted too. Single braces tolerated like
// parse-annotation-tags.ts.
const GRAMMAR_TAG_RE = /⟦([^⟧]+)⟧\{{1,2}g\|([a-z0-9-]+)(?:\|(\d+))?\}{1,2}/g;

export function parseGrammarTags(
  text: string,
  rawInput: string,
): ParseGrammarTagsResult {
  const spans: GrammarSpan[] = [];
  let reconstructed = '';
  let lastIndex = 0;
  let cursor = 0;
  let allResolved = true;

  GRAMMAR_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null = GRAMMAR_TAG_RE.exec(rawInput);
  while (match !== null) {
    reconstructed += rawInput.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    const form = match[1];
    const slug = match[2];
    const egpIndex = match[3] ? Number(match[3]) : null;
    reconstructed += form;

    const idx = text.indexOf(form, cursor);
    if (idx === -1) {
      allResolved = false;
    } else {
      spans.push({
        form,
        charStart: idx,
        charEnd: idx + form.length,
        slug,
        egpIndex,
      });
      cursor = idx + form.length;
    }

    match = GRAMMAR_TAG_RE.exec(rawInput);
  }
  reconstructed += rawInput.slice(lastIndex);

  return { spans, isComplete: allResolved && reconstructed === text };
}
