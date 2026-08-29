import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  classifyEgpRecord,
  type EgpRecord,
  grammarConstructionSlug,
  parseEgpRecords,
} from '../../src/modules/post/domain/egp.js';
import {
  buildGrammarCatalog,
  type GrammarCatalogEntry,
  GRAMMAR_SYSTEM_PROMPT,
} from '../../src/modules/post/domain/grammar-prompt.js';

export interface GrammarCatalog {
  // GRAMMAR_SYSTEM_PROMPT + the rendered catalogue, exactly what
  // TagGrammarHandler.loadCatalog builds and sends.
  systemPrompt: string;
  // slug -> set of egpIndexes that belong to that construction. Mirrors
  // TagGrammarHandler's `egpIndexesBySlug`; the handler drops any span whose
  // slug is unknown or whose egpIndex is not in this set.
  egpIndexesBySlug: Map<string, Set<number>>;
  // Every egpIndex present in the catalogue (union of the above).
  validEgpIndexes: Set<number>;
  constructionCount: number;
  usagePointCount: number;
}

// Rebuilds the ai_grammar catalogue straight from assets/egp.json using the
// same domain helpers `engofy grammar import-egp` uses to seed the DB
// (classifyEgpRecord / grammarConstructionSlug) — so this harness needs no
// database, the same way the annotation harness needs no Nest DI. Only USE /
// FORM/USE records become usage points (PLAN.md §12), matching the importer.
//
// This yields 78 constructions / 574 usage points / 19 categories — the 78
// is expected, not a bug: import-egp seeds 90 GrammarConstruction rows but 12
// are cheat-sheet-only (no USE records), and TagGrammarHandler.loadCatalog
// filters those out (`constructions.filter(c => pointsBySlug.has(c.slug))`)
// before rendering the prompt. So 78/574 is exactly what production sends.
//
// One deliberate difference from TagGrammarHandler.loadCatalog: constructions
// are ordered as they first appear in egp.json (grouped category ->
// subcategory in the source) rather than by the per-category `sortOrder` the
// importer writes. The set of constructions and usage points is identical;
// only their order in the rendered prompt differs, which does not affect
// which spans are valid.
export function buildGrammarCatalogFromAsset(repoRoot: string): GrammarCatalog {
  const records = parseEgpRecords(
    JSON.parse(readFileSync(resolve(repoRoot, 'assets/egp.json'), 'utf8')),
  );

  const recordsBySlug = new Map<string, EgpRecord[]>();
  const slugOrder: string[] = [];
  for (const record of records) {
    const slug = grammarConstructionSlug(record.category, record.subcategory);
    let bucket = recordsBySlug.get(slug);
    if (!bucket) {
      bucket = [];
      recordsBySlug.set(slug, bucket);
      slugOrder.push(slug);
    }
    bucket.push(record);
  }

  const entries: GrammarCatalogEntry[] = [];
  const egpIndexesBySlug = new Map<string, Set<number>>();
  const validEgpIndexes = new Set<number>();
  let usagePointCount = 0;

  for (const slug of slugOrder) {
    const bucket = recordsBySlug.get(slug) ?? [];
    const usePoints = bucket.filter((r) => classifyEgpRecord(r) === 'use');
    if (usePoints.length === 0) {
      continue; // no SRS-unit usage points -> not in the tagging catalogue
    }

    const egpIndexes = new Set<number>();
    for (const r of usePoints) {
      egpIndexes.add(r.index);
      validEgpIndexes.add(r.index);
    }
    egpIndexesBySlug.set(slug, egpIndexes);
    usagePointCount += usePoints.length;

    entries.push({
      slug,
      name: bucket[0].subcategory,
      usagePoints: usePoints.map((r) => ({
        egpIndex: r.index,
        cefr: r.level,
        guideword: r.guideword,
        canDoStatement: r.can_do,
      })),
    });
  }

  return {
    systemPrompt: GRAMMAR_SYSTEM_PROMPT + buildGrammarCatalog(entries),
    egpIndexesBySlug,
    validEgpIndexes,
    constructionCount: entries.length,
    usagePointCount,
  };
}
