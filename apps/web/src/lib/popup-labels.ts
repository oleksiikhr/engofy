// Display text for the reader popup: the stored values are machine-shaped
// (enum slugs, ALL CAPS EGP guidewords with a `USE:` prefix, multi-sentence
// corpus examples) and are turned into learner-facing labels here.

const GUIDEWORD_PREFIX = /^(FORM\/USE|FORM|USE)\s*:\s*/i;
// A sentence ends at .!? (plus closing quotes/brackets) followed by a space
// and a capital, digit or opening quote — so "Mr. smith" style lowercase
// continuations and decimals stay in one piece.
const SENTENCE_END = /(?<=[.!?]['")\]]*)\s+(?=['"([]*[\p{Lu}\d])/u;
const MAX_EXAMPLE_CHARS = 180;
const MAX_EXAMPLE_SENTENCES = 2;

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "phrasal_verb" -> "phrasal verb"; the catch-all `other` has nothing to say.
function slugLabel(slug: string | null): string | null {
  const label = slug?.replaceAll('_', ' ').trim().toLowerCase();
  return label && label !== 'other' ? label : null;
}

export function posLabel(pos: string | null): string | null {
  return slugLabel(pos);
}

export function phraseTypeLabel(type: string | null): string | null {
  return slugLabel(type);
}

// "past perfect" -> "Past perfect". Only the first letter changes, so a name
// that carries a proper noun ("Present Perfect vs Past Simple") keeps its case.
export function constructionLabel(name: string): string {
  return upperFirst(splitSegments(name).join(', '));
}

// "USE: EARLIER PAST | PAST REFERENCE" -> "Earlier past, past reference".
export function guidewordLabel(guideword: string): string {
  const segments = splitSegments(guideword.replace(GUIDEWORD_PREFIX, ''));
  return upperFirst(
    segments
      .map((segment) => segment.toLowerCase())
      .join(', ')
      // Lowercasing an ALL CAPS guideword breaks the pronoun "I".
      .replace(/\bi\b/g, 'I'),
  );
}

function splitSegments(text: string): string[] {
  return text
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

// The first one or two sentences of an example — the corpus examples run to a
// whole paragraph. Two sentences are kept only while they stay short.
export function shortExample(example: string): string {
  const sentences = example
    .split(/\n+/)
    .flatMap((line) => line.trim().split(SENTENCE_END))
    .filter(Boolean);
  const first = sentences.slice(0, MAX_EXAMPLE_SENTENCES).join(' ');
  return first.length <= MAX_EXAMPLE_CHARS ? first : (sentences[0] ?? '');
}
