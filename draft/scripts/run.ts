import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ANNOTATION_SYSTEM_PROMPT } from '../../src/modules/post/domain/annotation-prompt.js';
import { annotateUnit } from '../lib/annotate-unit.js';
import { buildUnits, type Granularity } from '../lib/build-units.js';

// 'tagged-v1' now points straight at the real production prompt — kept as
// the map key (rather than renamed to e.g. 'prod') so existing baselines in
// draft/baselines/ referencing "tagged-v1" stay meaningful to compare
// against once the prompt itself gets a v2.
const PROMPTS: Record<string, string> = {
  'tagged-v1': ANNOTATION_SYSTEM_PROMPT,
};

const FLAG_PREFIX_RE = /^--/;

interface Args {
  content: string;
  prompt: string;
  unit: Granularity;
  thinking: boolean;
  model?: string;
}

function parseArgs(): Args {
  const flags = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(FLAG_PREFIX_RE, '').split('=');
      return [key, value ?? 'true'];
    }),
  );

  return {
    content: flags.get('content') ?? 'examples/content/article-complex.md',
    prompt: flags.get('prompt') ?? 'tagged-v1',
    unit: (flags.get('unit') as Granularity) ?? 'block',
    thinking: flags.get('thinking') === 'true',
    model: flags.get('model'),
  };
}

async function run(): Promise<void> {
  const args = parseArgs();
  const system = PROMPTS[args.prompt];
  if (!system) {
    throw new Error(
      `Unknown --prompt="${args.prompt}". Known: ${Object.keys(PROMPTS).join(', ')}`,
    );
  }

  const repoRoot = resolve(import.meta.dirname, '../..');
  const markdown = readFileSync(resolve(repoRoot, args.content), 'utf8');
  const units = buildUnits(markdown, args.unit);

  console.log(
    `Running ${units.length} unit(s) from ${args.content} through prompt "${args.prompt}" (unit=${args.unit})\n`,
  );

  const results: (Awaited<ReturnType<typeof annotateUnit>> & {
    label: string;
    text: string;
  })[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let totalElapsedMs = 0;

  for (const unit of units) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each iteration accumulates into totalInputTokens/etc. and appends to `results` in unit order; parallelizing would also hammer the API with every call at once.
    const result = await annotateUnit({
      system,
      text: unit.text,
      nodeOffsets: unit.nodeOffsets,
      model: args.model,
      thinking: args.thinking,
    });

    totalInputTokens += result.usage.inputTokens;
    totalOutputTokens += result.usage.outputTokens;
    totalCostUsd += result.usage.costUsd;
    totalElapsedMs += result.usage.elapsedMs;

    results.push({ label: unit.label, text: unit.text, ...result });

    console.log(`--- ${unit.label} ---`);
    console.log(`text: ${unit.text}`);
    console.log(`annotations: ${result.annotations.length}`);
    if (result.retried) {
      console.log('retried on isComplete: false with a second call');
    }
    if (result.validationError) {
      console.log(`VALIDATION FAILED: ${result.validationError}`);
    }
    if (!result.isComplete) {
      console.log('still incomplete after retry');
    }
    console.log('');
  }

  console.log('=== totals ===');
  console.log(`input tokens:  ${totalInputTokens}`);
  console.log(`output tokens: ${totalOutputTokens}`);
  console.log(`cost:          $${totalCostUsd.toFixed(4)}`);
  console.log(`elapsed:       ${(totalElapsedMs / 1000).toFixed(1)}s`);

  const resultsDir = resolve(repoRoot, 'draft/results');
  mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = resolve(
    resultsDir,
    `${timestamp}-${args.prompt}-${args.unit}.json`,
  );
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        contentFile: args.content,
        prompt: args.prompt,
        unit: args.unit,
        thinking: args.thinking,
        model: args.model,
        totals: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          costUsd: totalCostUsd,
          elapsedMs: totalElapsedMs,
        },
        blocks: results,
      },
      null,
      2,
    ),
  );
  console.log(`\nSaved: ${outFile}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
