// Same sentence-boundary heuristic as
// src/modules/content/domain/split-text-for-annotation.ts, copied rather
// than imported — this harness is meant to A/B *against* that file's
// chunking choice (paragraph vs sentence granularity), so it can't share
// the one implementation with the thing it's evaluating.
export function splitIntoSentences(text: string): string[] {
  const pattern = /[.!?](?=\s|$)/g;
  const sentences: string[] = [];
  let start = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    sentences.push(text.slice(start, match.index + 1).trim());
    start = match.index + 1;
    match = pattern.exec(text);
  }
  const rest = text.slice(start).trim();
  if (rest) {
    sentences.push(rest);
  }
  return sentences.filter(Boolean);
}
