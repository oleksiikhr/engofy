import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDIOM_SYSTEM_PROMPT } from '../../src/modules/post/domain/annotation-prompt.js';
import { type AnnotateUnitResult, annotateUnit } from '../lib/annotate-unit.js';
import { buildUnits, type Granularity } from '../lib/build-units.js';

// The annotation stage is now a thin AI pass: spaCy owns every word, the LLM
// only tags multi-word idioms / collocations (PLAN.md §6, §12). 'idiom-v1'
// points straight at the production constant; the old 'tagged-v1'
// (all-words) key is retired.
const PROMPTS: Record<string, string> = {
  'idiom-v1': IDIOM_SYSTEM_PROMPT,
};

const FLAG_PREFIX_RE = /^--/;

interface Args {
  files: string[];
  prompt: string;
  unit: Granularity;
  thinking: boolean;
  model?: string;
  name?: string;
}

function parseArgs(repoRoot: string): Args {
  const flags = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(FLAG_PREFIX_RE, '').split('=');
      return [key, value ?? 'true'];
    }),
  );

  const filesFlag = flags.get('files');
  const files = filesFlag
    ? filesFlag.split(',').map((f) => f.trim())
    : readdirSync(resolve(repoRoot, 'examples/content'))
        // README.md documents the fixtures (CLI ingest steps, psql
        // queries) — it is not learner content, and annotating it as
        // English prose wastes real API spend on meaningless output. Any
        // other non-content .md file added later should follow the same
        // README naming convention to stay excluded automatically.
        .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
        .map((f) => `examples/content/${f}`)
        .sort();

  return {
    files,
    prompt: flags.get('prompt') ?? 'idiom-v1',
    unit: (flags.get('unit') as Granularity) ?? 'block',
    thinking: flags.get('thinking') === 'true',
    model: flags.get('model'),
    name: flags.get('name'),
  };
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

interface UnitMetrics {
  label: string;
  textLength: number;
  // Every annotation is an idiom / collocation phrase now — kept as
  // `annotationCount` for baseline-diff continuity; `phraseCount` mirrors it.
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

function emptyTotals(): FileSnapshot['totals'] {
  return {
    unitCount: 0,
    validationErrorCount: 0,
    retriedCount: 0,
    incompleteCount: 0,
    truncatedCount: 0,
    annotationCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    elapsedMs: 0,
  };
}

function unitStatusLine(label: string, result: AnnotateUnitResult): string {
  const flags = [
    result.validationError ? 'VALIDATION FAILED' : '',
    result.truncated ? 'TRUNCATED (max_tokens)' : '',
    result.retried ? 'retried' : '',
    result.isComplete ? '' : 'still incomplete after retry',
  ].filter(Boolean);
  return `  ${label}: ${result.annotations.length} annotations${
    flags.length ? `, ${flags.join(', ')}` : ''
  }`;
}

async function snapshotFile(
  repoRoot: string,
  contentFile: string,
  system: string,
  args: Args,
): Promise<FileSnapshot> {
  const markdown = readFileSync(resolve(repoRoot, contentFile), 'utf8');
  const units = buildUnits(markdown, args.unit);
  const totals = emptyTotals();
  const unitMetrics: UnitMetrics[] = [];

  for (const unit of units) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each iteration accumulates into `totals` and appends to `unitMetrics` in unit order; parallelizing would also hammer the API with every call in the file at once.
    const result = await annotateUnit({
      system,
      text: unit.text,
      nodeOffsets: unit.nodeOffsets,
      model: args.model,
      thinking: args.thinking,
    });

    const phraseCount = result.annotations.filter(
      (a) => a.kind === 'phrase',
    ).length;

    unitMetrics.push({
      label: unit.label,
      textLength: unit.text.length,
      annotationCount: result.annotations.length,
      phraseCount,
      validationError: result.validationError !== undefined,
      retried: result.retried,
      isComplete: result.isComplete,
      truncated: result.truncated,
    });

    totals.unitCount += 1;
    totals.validationErrorCount += result.validationError ? 1 : 0;
    totals.retriedCount += result.retried ? 1 : 0;
    totals.incompleteCount += result.isComplete ? 0 : 1;
    totals.truncatedCount += result.truncated ? 1 : 0;
    totals.annotationCount += result.annotations.length;
    totals.inputTokens += result.usage.inputTokens;
    totals.outputTokens += result.usage.outputTokens;
    totals.costUsd += result.usage.costUsd;
    totals.elapsedMs += result.usage.elapsedMs;

    console.log(unitStatusLine(unit.label, result));
  }

  return { contentFile, units: unitMetrics, totals };
}

async function main(): Promise<void> {
  const repoRoot = resolve(import.meta.dirname, '../..');
  const args = parseArgs(repoRoot);
  const system = PROMPTS[args.prompt];
  if (!system) {
    throw new Error(
      `Unknown --prompt="${args.prompt}". Known: ${Object.keys(PROMPTS).join(', ')}`,
    );
  }

  const model = args.model ?? process.env.AI_MODEL ?? 'unknown-model';
  const name = args.name ?? `${args.prompt}-${args.unit}-${sanitize(model)}`;

  console.log(
    `Snapshotting ${args.files.length} file(s) — prompt="${args.prompt}" unit=${args.unit} model=${model}\n`,
  );

  const files: FileSnapshot[] = [];
  for (const contentFile of args.files) {
    console.log(`${contentFile}:`);
    // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — files.push keeps output ordered the same as args.files, and running every content file's units concurrently would multiply in-flight API calls across the whole snapshot at once.
    files.push(await snapshotFile(repoRoot, contentFile, system, args));
  }

  const grandTotals = files.reduce((acc, f) => {
    for (const key of Object.keys(acc) as (keyof FileSnapshot['totals'])[]) {
      acc[key] += f.totals[key];
    }
    return acc;
  }, emptyTotals());

  const snapshot = {
    name,
    createdAt: new Date().toISOString(),
    prompt: args.prompt,
    unit: args.unit,
    model,
    thinking: args.thinking,
    files,
    grandTotals,
  };

  console.log('\n=== grand totals ===');
  console.log(`units:              ${grandTotals.unitCount}`);
  console.log(`validation errors:  ${grandTotals.validationErrorCount}`);
  console.log(`retried:            ${grandTotals.retriedCount}`);
  console.log(`still incomplete:   ${grandTotals.incompleteCount}`);
  console.log(`truncated:          ${grandTotals.truncatedCount}`);
  console.log(`annotations:        ${grandTotals.annotationCount}`);
  console.log(
    `tokens:             ${grandTotals.inputTokens} in / ${grandTotals.outputTokens} out`,
  );
  console.log(`cost:               $${grandTotals.costUsd.toFixed(4)}`);
  console.log(
    `elapsed:            ${(grandTotals.elapsedMs / 1000).toFixed(1)}s`,
  );

  const baselinesDir = resolve(repoRoot, 'draft/baselines');
  mkdirSync(baselinesDir, { recursive: true });
  const outFile = resolve(baselinesDir, `${name}.json`);
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
  console.log(`\nSaved: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
