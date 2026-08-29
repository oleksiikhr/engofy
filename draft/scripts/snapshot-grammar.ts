import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { buildGrammarCatalogFromAsset } from '../lib/grammar-catalog.js';
import { grammarTagFile } from '../lib/grammar-tag-file.js';
import { parseContentSentences } from '../lib/parse-content-sentences.js';

const FLAG_PREFIX_RE = /^--/;
// ai_grammar runs on sentences, so it is format-agnostic — unlike the
// annotation harness this one also snapshots the .html / .txt fixtures.
const CONTENT_EXT_RE = /\.(md|html?|txt)$/i;
const README_RE = /^readme\./i;

interface Args {
  files: string[];
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
        .filter((f) => CONTENT_EXT_RE.test(f) && !README_RE.test(f))
        .map((f) => `examples/content/${f}`)
        .sort();

  return {
    files,
    thinking: flags.get('thinking') === 'true',
    model: flags.get('model'),
    name: flags.get('name'),
  };
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

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
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  elapsedMs: number;
}

interface GrandTotals {
  fileCount: number;
  sentenceCount: number;
  spanCount: number;
  persistedCount: number;
  droppedUnknownSlug: number;
  droppedBadEgpIndex: number;
  droppedNoToken: number;
  incompleteCount: number;
  retriedCount: number;
  truncatedCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  elapsedMs: number;
}

async function snapshotFile(
  repoRoot: string,
  contentFile: string,
  args: Args,
  catalog: ReturnType<typeof buildGrammarCatalogFromAsset>,
): Promise<FileSnapshot> {
  const rawText = readFileSync(resolve(repoRoot, contentFile), 'utf8');
  const sentences = await parseContentSentences(rawText);
  const result = await grammarTagFile(catalog, sentences, {
    model: args.model,
    thinking: args.thinking,
  });
  const t = result.totals;

  console.log(
    `  ${t.sentenceCount} sentences, ${t.spanCount} spans ` +
      `(${t.persistedCount} kept / ${t.distinctConstructions} constructions, ` +
      `drop ${t.droppedUnknownSlug}+${t.droppedBadEgpIndex}+${t.droppedNoToken})` +
      (result.isComplete ? '' : ', INCOMPLETE') +
      (result.retried ? ', retried' : '') +
      (result.truncated ? ', TRUNCATED' : ''),
  );

  return {
    contentFile,
    sentenceCount: t.sentenceCount,
    spanCount: t.spanCount,
    persistedCount: t.persistedCount,
    droppedUnknownSlug: t.droppedUnknownSlug,
    droppedBadEgpIndex: t.droppedBadEgpIndex,
    droppedNoToken: t.droppedNoToken,
    distinctConstructions: t.distinctConstructions,
    spansPerSentence: t.spanCount / Math.max(t.sentenceCount, 1),
    isComplete: result.isComplete,
    retried: result.retried,
    truncated: result.truncated,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: result.usage.costUsd,
    elapsedMs: result.usage.elapsedMs,
  };
}

async function main(): Promise<void> {
  const repoRoot = resolve(import.meta.dirname, '../..');
  const args = parseArgs(repoRoot);

  const catalog = buildGrammarCatalogFromAsset(repoRoot);
  const model = args.model ?? process.env.AI_MODEL ?? 'unknown-model';
  const name = args.name ?? `grammar-${sanitize(model)}`;

  console.log(
    `Snapshotting ${args.files.length} file(s) — model=${model} ` +
      `catalogue=${catalog.constructionCount}c/${catalog.usagePointCount}up\n`,
  );

  const files: FileSnapshot[] = [];
  for (const contentFile of args.files) {
    console.log(`${contentFile}:`);
    // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — keeps output ordered and avoids firing every file's API + nlp calls at once.
    files.push(await snapshotFile(repoRoot, contentFile, args, catalog));
  }

  const grandTotals: GrandTotals = {
    fileCount: files.length,
    sentenceCount: 0,
    spanCount: 0,
    persistedCount: 0,
    droppedUnknownSlug: 0,
    droppedBadEgpIndex: 0,
    droppedNoToken: 0,
    incompleteCount: 0,
    retriedCount: 0,
    truncatedCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    elapsedMs: 0,
  };
  for (const f of files) {
    grandTotals.sentenceCount += f.sentenceCount;
    grandTotals.spanCount += f.spanCount;
    grandTotals.persistedCount += f.persistedCount;
    grandTotals.droppedUnknownSlug += f.droppedUnknownSlug;
    grandTotals.droppedBadEgpIndex += f.droppedBadEgpIndex;
    grandTotals.droppedNoToken += f.droppedNoToken;
    grandTotals.incompleteCount += f.isComplete ? 0 : 1;
    grandTotals.retriedCount += f.retried ? 1 : 0;
    grandTotals.truncatedCount += f.truncated ? 1 : 0;
    grandTotals.inputTokens += f.inputTokens;
    grandTotals.outputTokens += f.outputTokens;
    grandTotals.costUsd += f.costUsd;
    grandTotals.elapsedMs += f.elapsedMs;
  }

  const snapshot = {
    name,
    createdAt: new Date().toISOString(),
    model,
    thinking: args.thinking,
    catalogue: {
      constructionCount: catalog.constructionCount,
      usagePointCount: catalog.usagePointCount,
    },
    files,
    grandTotals,
  };

  console.log('\n=== grand totals ===');
  console.log(`files:              ${grandTotals.fileCount}`);
  console.log(`sentences:          ${grandTotals.sentenceCount}`);
  console.log(`spans tagged:       ${grandTotals.spanCount}`);
  console.log(`  persisted:        ${grandTotals.persistedCount}`);
  console.log(`  drop unknown slug:${grandTotals.droppedUnknownSlug}`);
  console.log(`  drop bad egpIndex:${grandTotals.droppedBadEgpIndex}`);
  console.log(`  drop no token:    ${grandTotals.droppedNoToken}`);
  console.log(
    `spans/sentence:     ${(grandTotals.spanCount / Math.max(grandTotals.sentenceCount, 1)).toFixed(2)}`,
  );
  console.log(`incomplete files:   ${grandTotals.incompleteCount}`);
  console.log(`retried files:      ${grandTotals.retriedCount}`);
  console.log(`truncated files:    ${grandTotals.truncatedCount}`);
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
