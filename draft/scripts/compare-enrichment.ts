import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PostSnapshot {
  shortId: string;
  title: string | null;
  wordCount: number;
  phraseCount: number;
  wordsMissingPhonetic: number;
  cefrCounts: Record<string, number>;
  isComplete: boolean;
  error?: string;
  truncated: boolean;
}

interface Snapshot {
  name: string;
  createdAt: string;
  model: string;
  posts: PostSnapshot[];
  grandTotals: Record<string, number>;
}

function loadSnapshot(path: string): Snapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
}

// Same principle as compare-grammar.ts: flag a post REGRESSED only on hard
// failures, never on word/phrase-count drift (which just reflects the dev
// DB's annotated content changing between snapshots, or LLM sampling on the
// definitions themselves) — isComplete going true->false (the model dropped,
// duplicated, or invented an index — indexEnrichmentResult's all-or-nothing
// check) or truncated going false->true.
type Verdict = 'regressed' | 'improved' | 'same' | 'added' | 'removed';

interface Dimension {
  label: string;
  regressed: boolean;
  improved: boolean;
}

function dimensions(b: PostSnapshot, c: PostSnapshot): Dimension[] {
  return [
    {
      label: 'isComplete',
      regressed: b.isComplete && !c.isComplete,
      improved: !b.isComplete && c.isComplete,
    },
    {
      label: 'truncated',
      regressed: !b.truncated && c.truncated,
      improved: b.truncated && !c.truncated,
    },
  ];
}

function comparePost(
  b: PostSnapshot | undefined,
  c: PostSnapshot | undefined,
): { verdict: Verdict; lines: string[] } {
  if (!b) {
    return { verdict: 'added', lines: ['  (only in candidate)'] };
  }
  if (!c) {
    return { verdict: 'removed', lines: ['  (only in baseline)'] };
  }

  const dims = dimensions(b, c);
  const regressed = dims.some((d) => d.regressed);
  const improved = !regressed && dims.some((d) => d.improved);
  const verdict: Verdict = regressed
    ? 'regressed'
    : improved
      ? 'improved'
      : 'same';

  if (verdict === 'same') {
    return { verdict, lines: [] };
  }

  const flags = dims
    .filter((d) => d.regressed || d.improved)
    .map((d) => `${d.regressed ? '✗' : '✓'}${d.label}`)
    .join(' ');
  const fmt = (p: PostSnapshot): string =>
    `words=${p.wordCount} phrases=${p.phraseCount} ` +
    `missingPhonetic=${p.wordsMissingPhonetic} ` +
    `complete=${p.isComplete} truncated=${p.truncated}` +
    (p.error ? ` error=${p.error}` : '');

  return {
    verdict,
    lines: [
      `  ${flags}`,
      `      baseline:  ${fmt(b)}`,
      `      candidate: ${fmt(c)}`,
    ],
  };
}

function icon(verdict: Verdict): string {
  switch (verdict) {
    case 'regressed':
      return '✗ REGRESSED';
    case 'improved':
      return '✓ improved';
    case 'added':
      return '- added';
    case 'removed':
      return '- removed';
    default:
      return '= same';
  }
}

function main(): void {
  const [baselinePath, candidatePath] = process.argv.slice(2);
  if (!baselinePath || !candidatePath) {
    console.error(
      'Usage: tsx draft/scripts/compare-enrichment.ts <baseline.json> <candidate.json>',
    );
    process.exitCode = 1;
    return;
  }

  const repoRoot = resolve(import.meta.dirname, '../..');
  const baseline = loadSnapshot(resolve(repoRoot, baselinePath));
  const candidate = loadSnapshot(resolve(repoRoot, candidatePath));

  console.log(
    `Baseline:  ${baseline.name} (${baseline.model}, ${baseline.createdAt})`,
  );
  console.log(
    `Candidate: ${candidate.name} (${candidate.model}, ${candidate.createdAt})\n`,
  );

  const byPost = (s: Snapshot): Map<string, PostSnapshot> =>
    new Map(s.posts.map((p) => [p.shortId, p]));
  const baselineByPost = byPost(baseline);
  const candidateByPost = byPost(candidate);
  const allPosts = [
    ...new Set([...baselineByPost.keys(), ...candidateByPost.keys()]),
  ].sort();

  let regressions = 0;
  for (const shortId of allPosts) {
    const { verdict, lines } = comparePost(
      baselineByPost.get(shortId),
      candidateByPost.get(shortId),
    );
    if (verdict === 'regressed') {
      regressions += 1;
    }
    if (verdict === 'same') {
      continue;
    }
    console.log(`${shortId}: ${icon(verdict)}`);
    for (const line of lines) {
      console.log(line);
    }
    console.log('');
  }

  const bt = baseline.grandTotals;
  const ct = candidate.grandTotals;
  const row = (label: string, key: string): void => {
    console.log(`${label.padEnd(22)} ${bt[key] ?? 0} -> ${ct[key] ?? 0}`);
  };
  console.log('=== grand totals: baseline -> candidate ===');
  row('words:', 'wordCount');
  row('phrases:', 'phraseCount');
  row('missing phonetic:', 'wordsMissingPhonetic');
  row('incomplete posts:', 'incompleteCount');
  row('truncated posts:', 'truncatedCount');
  console.log(
    `${'cost:'.padEnd(22)} $${(bt.costUsd ?? 0).toFixed(4)} -> $${(ct.costUsd ?? 0).toFixed(4)}`,
  );

  console.log('');
  if (regressions > 0) {
    console.log(`RESULT: ✗ ${regressions} regression(s) found`);
    process.exitCode = 1;
  } else {
    console.log('RESULT: ✓ no regressions');
  }
}

main();
