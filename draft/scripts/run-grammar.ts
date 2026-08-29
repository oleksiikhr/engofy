import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGrammarCatalogFromAsset } from '../lib/grammar-catalog.js';
import { grammarTagFile } from '../lib/grammar-tag-file.js';
import { parseContentSentences } from '../lib/parse-content-sentences.js';

const FLAG_PREFIX_RE = /^--/;

interface Args {
  content: string;
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
    thinking: flags.get('thinking') === 'true',
    model: flags.get('model'),
  };
}

async function run(): Promise<void> {
  const args = parseArgs();
  const repoRoot = resolve(import.meta.dirname, '../..');

  const catalog = buildGrammarCatalogFromAsset(repoRoot);
  console.log(
    `Catalogue: ${catalog.constructionCount} constructions / ${catalog.usagePointCount} usage points (from assets/egp.json)\n`,
  );

  const rawText = readFileSync(resolve(repoRoot, args.content), 'utf8');
  const sentences = await parseContentSentences(rawText);
  console.log(
    `Parsed ${sentences.length} sentence(s) from ${args.content} via nlp-service\n`,
  );

  const result = await grammarTagFile(catalog, sentences, {
    model: args.model,
    thinking: args.thinking,
  });

  for (const sentence of result.sentences) {
    console.log(`--- [${sentence.index}] ${sentence.label} ---`);
    console.log(sentence.text);
    if (sentence.spans.length === 0) {
      console.log('  (no spans)');
    }
    for (const span of sentence.spans) {
      const range =
        span.tokenStart !== undefined
          ? ` tokens ${span.tokenStart}..${span.tokenEnd}`
          : '';
      const tag =
        span.disposition === 'persisted'
          ? '✓'
          : `✗ ${span.disposition}`;
      console.log(
        `  ${tag}  "${span.form}"  {g|${span.slug}|${span.egpIndex ?? '—'}}${range}`,
      );
    }
    console.log('');
  }

  const t = result.totals;
  console.log('=== totals ===');
  console.log(`sentences:              ${t.sentenceCount}`);
  console.log(`spans tagged:           ${t.spanCount}`);
  console.log(
    `  persisted:            ${t.persistedCount} (${t.distinctConstructions} distinct constructions)`,
  );
  console.log(`  dropped unknown slug: ${t.droppedUnknownSlug}`);
  console.log(`  dropped bad egpIndex: ${t.droppedBadEgpIndex}`);
  console.log(`  dropped no token:     ${t.droppedNoToken}`);
  console.log(
    `spans/sentence:         ${(t.spanCount / Math.max(t.sentenceCount, 1)).toFixed(2)}`,
  );
  console.log(`isComplete:             ${result.isComplete}`);
  console.log(`retried:                ${result.retried}`);
  console.log(`truncated (max_tokens): ${result.truncated}`);
  console.log(`input tokens:           ${result.usage.inputTokens}`);
  console.log(`output tokens:          ${result.usage.outputTokens}`);
  console.log(`cost:                   $${result.usage.costUsd.toFixed(4)}`);
  console.log(
    `elapsed:                ${(result.usage.elapsedMs / 1000).toFixed(1)}s`,
  );

  const resultsDir = resolve(repoRoot, 'draft/results');
  mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = resolve(resultsDir, `${timestamp}-grammar.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        contentFile: args.content,
        model: args.model,
        thinking: args.thinking,
        isComplete: result.isComplete,
        retried: result.retried,
        truncated: result.truncated,
        totals: result.totals,
        usage: result.usage,
        sentences: result.sentences,
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
