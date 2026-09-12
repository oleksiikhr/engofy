import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const WORD_FREQUENCY_LIST_PATH = join(
  process.cwd(),
  'assets',
  'word-frequency.txt',
);

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

let cachedRanks: Promise<Map<string, number>> | null = null;

// Cached for the process lifetime — 50k lines parsed once, reused by every
// annotate-post job (build-token-annotations.ts) rather than re-read from
// disk per job. Independent of `words.frequency_rank` (only backfilled for
// lemmas already in the `words` table, PLAN.md §3.3): this lookup must also
// cover a lemma the pipeline has never seen before.
export function loadWordFrequencyRanks(): Promise<Map<string, number>> {
  cachedRanks ??= readFile(WORD_FREQUENCY_LIST_PATH, 'utf-8').then(
    parseWordFrequencyList,
  );
  return cachedRanks;
}
