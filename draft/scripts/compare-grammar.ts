import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FileSnapshot {
  contentFile: string;
  sentenceCount: number;
  spanCount: number;
  persistedCount: number;
  droppedUnknownSlug: number;
  droppedBadEgpIndex: number;
  droppedNoToken: number;
  distinctConstructions: number;
  spansPerSentence: number;
  isComplete: boolean;
  retried: boolean;
  truncated: boolean;
}

interface Snapshot {
  name: string;
  createdAt: string;
  model: string;
  files: FileSnapshot[];
  grandTotals: Record<string, number>;
}

function loadSnapshot(path: string): Snapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
}

// A file regresses only on the dimensions the harness treats as hard
// failures — never on span/persisted counts alone, which vary run to run
// from LLM sampling with zero code change (same principle as compare.ts):
//  - isComplete went true -> false (a sentence didn't come back / didn't
//    reconstruct, even after the retry)
//  - truncated went false -> true (max_tokens cut the response off)
//  - persistedCount collapsed to 0 when it wasn't (tagging effectively broke
//    for this file)
//  - catalogue drops (unknown slug + bad egpIndex) went up — the catalogue
//    is closed, so the model inventing tags outside it is a real defect, not
//    sampling noise. `droppedNoToken` is offset/tokenisation interaction and
//    is reported but not flagged.
type Verdict = 'regressed' | 'improved' | 'same' | 'added' | 'removed';

interface Dimension {
  label: string;
  regressed: boolean;
  improved: boolean;
}

function dimensions(b: FileSnapshot, c: FileSnapshot): Dimension[] {
  const catalogueDrops = (f: FileSnapshot): number =>
    f.droppedUnknownSlug + f.droppedBadEgpIndex;

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
    {
      label: 'persistedCount->0',
      regressed: b.persistedCount > 0 && c.persistedCount === 0,
      improved: b.persistedCount === 0 && c.persistedCount > 0,
    },
    {
      label: 'catalogueDrops',
      regressed: catalogueDrops(c) > catalogueDrops(b),
      improved: catalogueDrops(c) < catalogueDrops(b),
    },
  ];
}

function compareFile(
  b: FileSnapshot | undefined,
  c: FileSnapshot | undefined,
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
  const fmt = (f: FileSnapshot): string =>
    `spans=${f.spanCount} kept=${f.persistedCount} ` +
    `constructions=${f.distinctConstructions} ` +
    `drops=${f.droppedUnknownSlug}/${f.droppedBadEgpIndex}/${f.droppedNoToken} ` +
    `complete=${f.isComplete} truncated=${f.truncated}`;

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
      'Usage: tsx draft/scripts/compare-grammar.ts <baseline.json> <candidate.json>',
    );
    process.exitCode = 1;
    return;
  }

  const repoRoot = resolve(import.meta.dirname, '../..');
  const baseline = loadSnapshot(resolve(repoRoot, baselinePath));
  const candidate = loadSnapshot(resolve(repoRoot, candidatePath));

  console.log(`Baseline:  ${baseline.name} (${baseline.model}, ${baseline.createdAt})`);
  console.log(
    `Candidate: ${candidate.name} (${candidate.model}, ${candidate.createdAt})\n`,
  );

  const byFile = (s: Snapshot): Map<string, FileSnapshot> =>
    new Map(s.files.map((f) => [f.contentFile, f]));
  const baselineByFile = byFile(baseline);
  const candidateByFile = byFile(candidate);
  const allFiles = [
    ...new Set([...baselineByFile.keys(), ...candidateByFile.keys()]),
  ].sort();

  let regressions = 0;
  for (const contentFile of allFiles) {
    const { verdict, lines } = compareFile(
      baselineByFile.get(contentFile),
      candidateByFile.get(contentFile),
    );
    if (verdict === 'regressed') {
      regressions += 1;
    }
    if (verdict === 'same') {
      continue;
    }
    console.log(`${contentFile}: ${icon(verdict)}`);
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
  row('sentences:', 'sentenceCount');
  row('spans tagged:', 'spanCount');
  row('persisted:', 'persistedCount');
  row('drop unknown slug:', 'droppedUnknownSlug');
  row('drop bad egpIndex:', 'droppedBadEgpIndex');
  row('drop no token:', 'droppedNoToken');
  row('incomplete files:', 'incompleteCount');
  row('truncated files:', 'truncatedCount');
  row('retried files:', 'retriedCount');
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
