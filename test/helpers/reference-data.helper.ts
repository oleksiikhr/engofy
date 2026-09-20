import type { GrammarUsagePoint } from '../../src/modules/post/entities/grammar-usage-point.entity.js';
import type { WordDefinition } from '../../src/modules/post/entities/word-definition.entity.js';
import type { Factories } from '../factories/factories.js';

type WordDefinitionOverrides = Parameters<
  Factories['wordDefinition']['makeOne']
>[0];
type GrammarUsagePointOverrides = Parameters<
  Factories['grammarUsagePoint']['makeOne']
>[0];

// Scenario helpers: reference-data FKs are `restrict`, so a card / disposition /
// plan needs a real definition or usage point (with its own parents).
// Nothing is flushed — the caller's `em.flush()` orders the inserts by FK.
export function makeWordDefinition(
  f: Factories,
  overrides: WordDefinitionOverrides = {},
): WordDefinition {
  const word = f.word.makeOne();

  return f.wordDefinition.makeOne({ wordId: word.id, ...overrides });
}

export function makeGrammarUsagePoint(
  f: Factories,
  overrides: GrammarUsagePointOverrides = {},
): GrammarUsagePoint {
  const category = f.grammarCategory.makeOne();
  const construction = f.grammarConstruction.makeOne({
    categoryId: category.id,
  });

  return f.grammarUsagePoint.makeOne({
    constructionId: construction.id,
    ...overrides,
  });
}
