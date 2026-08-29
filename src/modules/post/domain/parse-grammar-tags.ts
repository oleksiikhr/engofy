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
  // does not reconstruct `text` character-for-character, when a ⟦ is left
  // unclosed, or when a closed span does not match `text` at its offsets.
  // The caller retries once on false.
  isComplete: boolean;
}

const OPEN = '⟦';
const CLOSE = '⟧';
// The {{g|slug|egpIndex}} trailer that must follow a closing ⟧. egpIndex is
// optional (⟦span⟧{{g|slug}}); single braces are tolerated like
// parse-annotation-tags.ts. Sticky so it only matches immediately after ⟧.
const TRAILER_RE = /\{{1,2}g\|([a-z0-9-]+)(?:\|(\d+))?\}{1,2}/y;

interface WalkState {
  plain: string;
  intact: boolean;
  index: number;
}

// Handles one ⟧ at `state.index`: matches its {{g|…}} trailer, pops the
// matching ⟦ off `openStack`, and records the span when its offsets line up
// with `text`. Advances `state.index` past whatever it consumed.
function consumeClose(
  rawInput: string,
  text: string,
  openStack: number[],
  spans: GrammarSpan[],
  state: WalkState,
): void {
  TRAILER_RE.lastIndex = state.index + 1;
  const trailer = TRAILER_RE.exec(rawInput);
  if (!trailer) {
    // A bare ⟧ with no tag — keep the char so reconstruction diverges.
    state.intact = false;
    state.plain += CLOSE;
    state.index += 1;
    return;
  }

  const start = openStack.pop();
  state.index += 1 + trailer[0].length;
  if (start === undefined) {
    state.intact = false;
    return;
  }

  const form = state.plain.slice(start);
  if (text.slice(start, state.plain.length) === form) {
    spans.push({
      form,
      charStart: start,
      charEnd: state.plain.length,
      slug: trailer[1],
      egpIndex: trailer[2] ? Number(trailer[2]) : null,
    });
  } else {
    state.intact = false;
  }
}

// Stack-based walk of the inline ⟦…⟧{{g|…}} markup. Unlike a flat regex
// scan it handles nested tags — the model does wrap a smaller construction
// inside a larger one (⟦outer ⟦inner⟧{{g|a|1}} tail⟧{{g|b|2}}) — recording
// both spans with offsets taken straight from the reconstructed plain text,
// so no separate indexOf lookup is needed. isComplete stays strict: every ⟦
// must close with a valid trailer and the stripped text must equal `text`.
export function parseGrammarTags(
  text: string,
  rawInput: string,
): ParseGrammarTagsResult {
  const spans: GrammarSpan[] = [];
  const openStack: number[] = [];
  const state: WalkState = { plain: '', intact: true, index: 0 };
  const n = rawInput.length;

  while (state.index < n) {
    const ch = rawInput[state.index];
    if (ch === OPEN) {
      openStack.push(state.plain.length);
      state.index += 1;
    } else if (ch === CLOSE) {
      consumeClose(rawInput, text, openStack, spans, state);
    } else {
      state.plain += ch;
      state.index += 1;
    }
  }

  if (openStack.length > 0) {
    state.intact = false;
  }

  return { spans, isComplete: state.intact && state.plain === text };
}
