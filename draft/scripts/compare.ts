import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface UnitMetrics {
  label: string;
  textLength: number;
  annotationCount: number;
  phraseCount: number;
  validationError: boolean;
  retried: boolean;
  isComplete: boolean;
  truncated: boolean;
}

interface FileSnapshot {
  contentFile: string;
  units: UnitMetrics[];
  totals: {
    unitCount: number;
    validationErrorCount: number;
    retriedCount: number;
    incompleteCount: number;
    truncatedCount: number;
    annotationCount: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    elapsedMs: number;
  };
}

interface Snapshot {
  name: string;
  createdAt: string;
  prompt: string;
  unit: string;
  model: string;
  files: FileSnapshot[];
  grandTotals: FileSnapshot['totals'];
}

function loadSnapshot(path: string): Snapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
}

// A unit only counts as regressed on dimensions the whole harness treats as
// hard failures elsewhere (validateAnnotations, isComplete: false even
// after the retry, truncated — prod throws on that) — never on
// annotationCount, which legitimately varies
// run to run even with no code/prompt/model change (LLM sampling).
// `retried` is reported but not itself a regression: the retry firing and
// then resolving is the safety net working as designed, not a defect.
type Verdict =
  | 'regressed'
  | 'improved'
  | 'same'
  | 'only-in-baseline'
  | 'only-in-candidate';

function compareUnit(
  baseline: UnitMetrics | undefined,
  candidate: UnitMetrics | undefined,
): Verdict {
  if (!baseline) {
    return 'only-in-candidate';
  }
  if (!candidate) {
    return 'only-in-baseline';
  }

  const baselineBad =
    (baseline.validationError ? 1 : 0) +
    (baseline.isComplete ? 0 : 1) +
    (baseline.truncated ? 1 : 0);
  const candidateBad =
    (candidate.validationError ? 1 : 0) +
    (candidate.isComplete ? 0 : 1) +
    (candidate.truncated ? 1 : 0);

  if (candidateBad > baselineBad) {
    return 'regressed';
  }
  if (candidateBad < baselineBad) {
    return 'improved';
  }
  return 'same';
}

function verdictIcon(verdict: Verdict): string {
  switch (verdict) {
    case 'regressed':
      return '✗ REGRESSED';
    case 'improved':
      return '✓ improved';
    case 'only-in-baseline':
      return '- only in baseline';
    case 'only-in-candidate':
      return '- only in candidate';
    default:
      return '= same';
  }
}

function compareFile(
  baseline: FileSnapshot | undefined,
  candidate: FileSnapshot | undefined,
): { lines: string[]; regressions: number } {
  const lines: string[] = [];
  let regressions = 0;

  if (!baseline || !candidate) {
    lines.push(
      `  (file only present in ${baseline ? 'baseline' : 'candidate'} — skipped)`,
    );
    return { lines, regressions };
  }

  const baselineByLabel = new Map(baseline.units.map((u) => [u.label, u]));
  const candidateByLabel = new Map(candidate.units.map((u) => [u.label, u]));
  const allLabels = new Set([
    ...baselineByLabel.keys(),
    ...candidateByLabel.keys(),
  ]);

  for (const label of allLabels) {
    const b = baselineByLabel.get(label);
    const c = candidateByLabel.get(label);
    const verdict = compareUnit(b, c);
    if (verdict === 'regressed') {
      regressions += 1;
    }

    if (verdict === 'same') {
      continue; // quiet unless something to report
    }

    const bDesc = b
      ? `ann=${b.annotationCount} valid=${!b.validationError} complete=${b.isComplete} truncated=${b.truncated} retried=${b.retried}`
      : '(missing)';
    const cDesc = c
      ? `ann=${c.annotationCount} valid=${!c.validationError} complete=${c.isComplete} truncated=${c.truncated} retried=${c.retried}`
      : '(missing)';
    lines.push(`  [${verdictIcon(verdict)}] ${label}`);
    lines.push(`      baseline:  ${bDesc}`);
    lines.push(`      candidate: ${cDesc}`);
  }

  if (lines.length === 0) {
    lines.push('  (no differences)');
  }

  return { lines, regressions };
}

function main(): void {
  const [baselinePath, candidatePath] = process.argv.slice(2);
  if (!baselinePath || !candidatePath) {
    console.error(
      'Usage: tsx draft/scripts/compare.ts <baseline.json> <candidate.json>',
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

  const baselineByFile = new Map(baseline.files.map((f) => [f.contentFile, f]));
  const candidateByFile = new Map(
    candidate.files.map((f) => [f.contentFile, f]),
  );
  const allFiles = new Set([
    ...baselineByFile.keys(),
    ...candidateByFile.keys(),
  ]);

  let totalRegressions = 0;
  for (const contentFile of allFiles) {
    const { lines, regressions } = compareFile(
      baselineByFile.get(contentFile),
      candidateByFile.get(contentFile),
    );
    totalRegressions += regressions;
    console.log(`${contentFile}:`);
    for (const line of lines) {
      console.log(line);
    }
    console.log('');
  }

  const bt = baseline.grandTotals;
  const ct = candidate.grandTotals;
  console.log('=== grand totals: baseline -> candidate ===');
  console.log(
    `validation errors:  ${bt.validationErrorCount} -> ${ct.validationErrorCount}`,
  );
  console.log(
    `still incomplete:   ${bt.incompleteCount} -> ${ct.incompleteCount}`,
  );
  console.log(
    `truncated:          ${bt.truncatedCount} -> ${ct.truncatedCount}`,
  );
  console.log(`retried:            ${bt.retriedCount} -> ${ct.retriedCount}`);
  console.log(
    `annotations:        ${bt.annotationCount} -> ${ct.annotationCount}`,
  );
  console.log(
    `cost:               $${bt.costUsd.toFixed(4)} -> $${ct.costUsd.toFixed(4)}`,
  );

  console.log('');
  if (totalRegressions > 0) {
    console.log(`RESULT: ✗ ${totalRegressions} regression(s) found`);
    process.exitCode = 1;
  } else {
    console.log('RESULT: ✓ no regressions');
  }
}

main();
