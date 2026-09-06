export interface TokenOffsets {
  position: number;
  charStart: number;
  charEnd: number;
}

export interface TokenRange {
  // Half-open range of SentenceToken.position values (PLAN.md §3.2
  // grammar_matches.token_start / token_end).
  tokenStart: number;
  tokenEnd: number;
}

// Maps a char span (from parseGrammarTags) onto the sentence's spaCy token
// positions: every token whose own char range overlaps the span is included.
// Returns null when the span covers no token (the model tagged whitespace or
// a range that fell between tokens) — the caller drops that match.
export function spanToTokenRange(
  span: { charStart: number; charEnd: number },
  tokens: TokenOffsets[],
): TokenRange | null {
  const covered = tokens.filter(
    (token) => token.charStart < span.charEnd && token.charEnd > span.charStart,
  );
  if (covered.length === 0) {
    return null;
  }

  const positions = covered.map((token) => token.position);
  return {
    tokenStart: Math.min(...positions),
    tokenEnd: Math.max(...positions) + 1,
  };
}
