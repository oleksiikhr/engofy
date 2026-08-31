import type { Annotation } from './validate-annotations.js';

export interface ParseAnnotationTagsResult {
  annotations: Annotation[];
  // False whenever the model's raw output — once every recognized tag is
  // stripped back to its underlying text — doesn't reconstruct `text`
  // character-for-character, OR any tag it did emit couldn't be resolved
  // back to a real position in `text`. Catches a truncated response, a
  // content word silently skipped mid-text (not just at the end), and a
  // malformed/leftover `{{...}}` the parser couldn't make sense of — all in
  // one check, without ever trusting a position the model claims. Callers
  // should retry once (same prompt, same full text) when this is false.
  isComplete: boolean;
}

// Matches either a phrase fragment — ⟦fragment text⟧{{p|type|canonical|groupId}} —
// or a single tagged word — word{{w|pos|lemma}}. The ⟦⟧ wrapper only exists
// for phrases, since a fragment there can be more than one token ("picked
// up"); a word tag never needs it because the token class already captures
// exactly one token.
//
// Fields are pipe-delimited, not colon-delimited — a lemma or canonical
// phrase can itself contain a colon (e.g. the time "11:47"), which would
// otherwise be indistinguishable from a field separator.
//
// Tolerates the model occasionally emitting single braces ({p|...}) instead
// of the prescribed {{p|...}} — the phrase/word/pos/lemma content itself is
// still correct when this happens, so the parser accepts it rather than
// discarding an otherwise-valid annotation.
//
// The word/fragment capture groups exclude `{`/`}`: with a variable-length
// `\{{1,2}` brace quantifier, a greedy token class that allowed braces would
// happily backtrack into swallowing a stray `{` (e.g. capturing "Two{" as
// the word, leaving a single "{" to satisfy `\{{1,2}`) before ever trying
// the intended split. Excluding braces removes that ambiguity outright.
const TOKEN_RE =
  /⟦([^⟧]+)⟧\{{1,2}p\|([a-z_]+)\|([^|{}]+)\|([^|{}]+)\}{1,2}|([^\s{}]+)\{{1,2}w\|([a-z_]+)\|([^|{}]+)\}{1,2}/g;

// A stray ⟦⟧ wrapper sometimes ends up around a single word tagged with
// {{w|...}} (word-kind, not phrase-kind) — the wrapper only means anything
// for a phrase tag. Strip it before the main pass so the word token class
// doesn't swallow the bracket characters as part of the form.
function stripStrayWordWrappers(raw: string): string {
  return raw.replace(/⟦([^⟧]+)⟧(\{{1,2}w\|)/g, '$1$2');
}

// The word branch's token class has no way to know a leading "(" or open
// quote isn't part of the word — the model correctly leaves it untagged
// (e.g. "(i.e.{{w|other|i.e.}}"), but regex .exec() finds the LEFTMOST
// position where the whole pattern matches, and "(" satisfies
// `[^\s{}]+` just as well as any letter does, so it gets absorbed into the
// capture. Stripping known opening-delimiter characters off the front of a
// captured word (never mid-word or trailing, where they're often
// legitimate — "on-call", "p.m.", "$2.3") fixes this without needing the
// model to change anything; it never had the wrong output to begin with.
// Only applied to the offset-lookup/`form` value — the reconstruction check
// below uses the untouched raw capture, since that's what's literally
// present in the model's output at that position.
const LEADING_PUNCT_RE = /^[("'[“‘]+/;

// Recovers offsets by walking `text` with a moving cursor and locating each
// tagged fragment via indexOf, in the order the model emitted them — never
// by trusting a position the model states. Simultaneously reconstructs the
// raw output with every recognized tag replaced by its underlying text, so
// completeness can be checked by exact string comparison against `text`
// rather than by a length/ratio heuristic.
//
// `cursor` (end of the last *resolved* token) is the hard search floor —
// it guarantees forward progress and stays sane when the model's output has
// drifted from `text` (a stray `{{}}` adds chars `text` doesn't have). But
// when the model tags only the later of two identical forms, indexOf from
// `cursor` would grab the earlier, untagged one. `reconstructed.length` is
// the position this token *should* sit at (every char emitted before it,
// tagged or not, is already in `reconstructed`); when reconstruction is
// still aligned and the fragment sits exactly there, prefer that position.
function resolveOffset(
  text: string,
  fragment: string,
  cursor: number,
  expected: number,
): number {
  const idx = text.indexOf(fragment, cursor);
  if (idx !== -1 && idx < expected && text.startsWith(fragment, expected)) {
    return expected;
  }
  return idx;
}

export function parseAnnotationTags(
  text: string,
  rawInput: string,
): ParseAnnotationTagsResult {
  const raw = stripStrayWordWrappers(rawInput);
  const annotations: Annotation[] = [];
  let reconstructed = '';
  let lastIndex = 0;
  let cursor = 0;
  let allResolved = true;

  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null = TOKEN_RE.exec(raw);
  while (match !== null) {
    reconstructed += raw.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    const expected = reconstructed.length;

    if (match[1] !== undefined) {
      const fragment = match[1];
      const phraseType = match[2] as string;
      const phraseText = match[3] as string;
      const phraseGroupId = match[4] as string;
      reconstructed += fragment;

      const idx = resolveOffset(text, fragment, cursor, expected);
      if (idx === -1) {
        allResolved = false;
      } else {
        annotations.push({
          start: idx,
          end: idx + fragment.length,
          form: fragment,
          kind: 'phrase',
          phraseType,
          phraseText,
          phraseGroupId,
        });
        cursor = idx + fragment.length;
      }
    } else {
      const rawWord = match[5] as string;
      const pos = match[6] as string;
      const lemma = match[7] as string;
      reconstructed += rawWord;

      const word = rawWord.replace(LEADING_PUNCT_RE, '');
      const idx = word ? resolveOffset(text, word, cursor, expected) : -1;

      if (idx === -1) {
        allResolved = false;
      } else {
        annotations.push({
          start: idx,
          end: idx + word.length,
          form: word,
          kind: 'word',
          pos,
          lemma,
        });
        cursor = idx + word.length;
      }
    }

    match = TOKEN_RE.exec(raw);
  }
  reconstructed += raw.slice(lastIndex);

  return {
    annotations,
    isComplete: allResolved && reconstructed === text,
  };
}
