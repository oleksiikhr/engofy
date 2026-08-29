// Parses assets/word-frequency.txt (one word per line, most frequent first)
// into a lowercase word -> 1-based rank map. Blank lines and repeats of an
// already-seen word are skipped without consuming a rank.
export function parseWordFrequencyList(text: string): Map<string, number> {
  const ranks = new Map<string, number>();

  for (const line of text.split('\n')) {
    const word = line.trim().toLowerCase();
    if (word && !ranks.has(word)) {
      ranks.set(word, ranks.size + 1);
    }
  }

  return ranks;
}
