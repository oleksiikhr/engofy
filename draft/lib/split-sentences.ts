// A self-contained sentence-boundary heuristic for this eval harness only.
// The production pipeline segments sentences via spaCy (`nlp-service`), not a
// regex — this harness deliberately keeps its own cheap splitter so it can A/B
// chunking granularity (paragraph vs sentence) without pulling in the service.
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
