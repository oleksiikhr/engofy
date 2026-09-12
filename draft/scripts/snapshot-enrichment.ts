import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Post } from '../../src/modules/post/entities/post.entity.js';
import { PostStatus } from '../../src/modules/post/enums/post-status.enum.js';
import { openDb } from '../lib/db.js';
import { enrichmentTagFile } from '../lib/enrichment-tag-file.js';
import { loadPostLexicon } from '../lib/load-post-lexicon.js';

const FLAG_PREFIX_RE = /^--/;

interface Args {
  shortIds?: string[];
  thinking: boolean;
  model?: string;
  name?: string;
}

function parseArgs(): Args {
  const flags = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(FLAG_PREFIX_RE, '').split('=');
      return [key, value ?? 'true'];
    }),
  );

  const shortIdsFlag = flags.get('shortIds');

  return {
    shortIds: shortIdsFlag?.split(',').map((s) => s.trim()),
    thinking: flags.get('thinking') === 'true',
    model: flags.get('model'),
    name: flags.get('name'),
  };
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

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
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  elapsedMs: number;
}

interface GrandTotals {
  postCount: number;
  wordCount: number;
  phraseCount: number;
  wordsMissingPhonetic: number;
  incompleteCount: number;
  truncatedCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  elapsedMs: number;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const model = args.model ?? process.env.AI_MODEL ?? 'unknown-model';
  const name = args.name ?? `enrichment-${sanitize(model)}`;

  const orm = await openDb();
  try {
    const shortIds =
      args.shortIds ??
      (
        await orm.em.find(
          Post,
          { status: PostStatus.Published },
          { orderBy: { shortId: 'asc' } },
        )
      ).map((p) => p.shortId);

    console.log(`Snapshotting ${shortIds.length} post(s) — model=${model}\n`);

    const posts: PostSnapshot[] = [];
    for (const shortId of shortIds) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — keeps output ordered and avoids firing every post's API call at once.
      const lexicon = await loadPostLexicon(orm.em, shortId);
      const result = await enrichmentTagFile(lexicon.words, lexicon.phrases, {
        model: args.model,
        thinking: args.thinking,
      });

      console.log(
        `${shortId} (${lexicon.title ?? '—'}): ${lexicon.words.length}w/${lexicon.phrases.length}p` +
          (result.isComplete ? '' : `, INCOMPLETE: ${result.error}`) +
          (result.truncated ? ', TRUNCATED' : ''),
      );

      posts.push({
        shortId,
        title: lexicon.title,
        wordCount: result.totals.wordCount,
        phraseCount: result.totals.phraseCount,
        wordsMissingPhonetic: result.totals.wordsMissingPhonetic,
        cefrCounts: result.totals.cefrCounts,
        isComplete: result.isComplete,
        error: result.error,
        truncated: result.truncated,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
        elapsedMs: result.usage.elapsedMs,
      });
    }

    const grandTotals: GrandTotals = {
      postCount: posts.length,
      wordCount: 0,
      phraseCount: 0,
      wordsMissingPhonetic: 0,
      incompleteCount: 0,
      truncatedCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      elapsedMs: 0,
    };
    for (const p of posts) {
      grandTotals.wordCount += p.wordCount;
      grandTotals.phraseCount += p.phraseCount;
      grandTotals.wordsMissingPhonetic += p.wordsMissingPhonetic;
      grandTotals.incompleteCount += p.isComplete ? 0 : 1;
      grandTotals.truncatedCount += p.truncated ? 1 : 0;
      grandTotals.inputTokens += p.inputTokens;
      grandTotals.outputTokens += p.outputTokens;
      grandTotals.costUsd += p.costUsd;
      grandTotals.elapsedMs += p.elapsedMs;
    }

    const snapshot = {
      name,
      createdAt: new Date().toISOString(),
      model,
      thinking: args.thinking,
      posts,
      grandTotals,
    };

    console.log('\n=== grand totals ===');
    console.log(`posts:              ${grandTotals.postCount}`);
    console.log(`words:              ${grandTotals.wordCount}`);
    console.log(`phrases:            ${grandTotals.phraseCount}`);
    console.log(`missing phonetic:   ${grandTotals.wordsMissingPhonetic}`);
    console.log(`incomplete posts:   ${grandTotals.incompleteCount}`);
    console.log(`truncated posts:    ${grandTotals.truncatedCount}`);
    console.log(
      `tokens:             ${grandTotals.inputTokens} in / ${grandTotals.outputTokens} out`,
    );
    console.log(`cost:               $${grandTotals.costUsd.toFixed(4)}`);
    console.log(
      `elapsed:            ${(grandTotals.elapsedMs / 1000).toFixed(1)}s`,
    );

    const repoRoot = resolve(import.meta.dirname, '../..');
    const baselinesDir = resolve(repoRoot, 'draft/baselines');
    mkdirSync(baselinesDir, { recursive: true });
    const outFile = resolve(baselinesDir, `${name}.json`);
    writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
    console.log(`\nSaved: ${outFile}`);
  } finally {
    await orm.close(true);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
