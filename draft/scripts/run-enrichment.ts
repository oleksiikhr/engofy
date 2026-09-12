import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb } from '../lib/db.js';
import { enrichmentTagFile } from '../lib/enrichment-tag-file.js';
import { loadPostLexicon } from '../lib/load-post-lexicon.js';

const FLAG_PREFIX_RE = /^--/;

interface Args {
  shortId: string;
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

  const shortId = flags.get('shortId');
  if (!shortId) {
    throw new Error(
      'Usage: tsx draft/scripts/run-enrichment.ts --shortId=<postShortId>',
    );
  }

  return {
    shortId,
    thinking: flags.get('thinking') === 'true',
    model: flags.get('model'),
  };
}

async function run(): Promise<void> {
  const args = parseArgs();
  const repoRoot = resolve(import.meta.dirname, '../..');

  const orm = await openDb();
  try {
    const lexicon = await loadPostLexicon(orm.em, args.shortId);
    console.log(
      `Post "${lexicon.title ?? lexicon.shortId}" (${lexicon.shortId}): ` +
        `${lexicon.words.length} word(s), ${lexicon.phrases.length} phrase(s)\n`,
    );

    const result = await enrichmentTagFile(lexicon.words, lexicon.phrases, {
      model: args.model,
      thinking: args.thinking,
    });

    if (!result.isComplete) {
      console.log(`INCOMPLETE: ${result.error}\n`);
    } else {
      lexicon.words.forEach((w, i) => {
        const entry = result.words[i];
        console.log(
          `[word]   "${w.lemma}" (${w.pos}) — ${entry.cefrLevel} ${entry.phonetic ?? '(no phonetic)'}`,
        );
        console.log(`         ${entry.definition}`);
        console.log(`         e.g. ${entry.example}`);
      });
      lexicon.phrases.forEach((p, i) => {
        const entry = result.phrases[i];
        console.log(`[phrase] "${p.phraseText}" — ${entry.cefrLevel}`);
        console.log(`         ${entry.definition}`);
        console.log(`         e.g. ${entry.example}`);
      });
    }

    console.log('\n=== totals ===');
    console.log(`words:              ${result.totals.wordCount}`);
    console.log(`phrases:            ${result.totals.phraseCount}`);
    console.log(`missing phonetic:   ${result.totals.wordsMissingPhonetic}`);
    console.log(
      `cefr:               ${JSON.stringify(result.totals.cefrCounts)}`,
    );
    console.log(`isComplete:         ${result.isComplete}`);
    console.log(`truncated:          ${result.truncated}`);
    console.log(`input tokens:       ${result.usage.inputTokens}`);
    console.log(`output tokens:      ${result.usage.outputTokens}`);
    console.log(`cost:               $${result.usage.costUsd.toFixed(4)}`);
    console.log(
      `elapsed:            ${(result.usage.elapsedMs / 1000).toFixed(1)}s`,
    );

    const resultsDir = resolve(repoRoot, 'draft/results');
    mkdirSync(resultsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = resolve(resultsDir, `${timestamp}-enrichment.json`);
    writeFileSync(
      outFile,
      JSON.stringify(
        { shortId: lexicon.shortId, title: lexicon.title, ...result },
        null,
        2,
      ),
    );
    console.log(`\nSaved: ${outFile}`);
  } finally {
    await orm.close(true);
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
