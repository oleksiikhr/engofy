import type { GrammarSiblingUsagePoint, LexiconData } from './reader-lexicon';
import type { GrammarAnnotation, PostDetail } from './types';

// The "why this, not that" explanation the grammar_contrastive exercise
// generated for each usage point (the first one when a point has several).
function contrastByUsagePoint(
  exercises: PostDetail['exercises'],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const exercise of exercises) {
    const { grammarUsagePointId, explanation } = exercise.payload;
    if (
      exercise.type === 'grammar_contrastive' &&
      typeof grammarUsagePointId === 'string' &&
      typeof explanation === 'string' &&
      !out.has(grammarUsagePointId)
    ) {
      out.set(grammarUsagePointId, explanation);
    }
  }
  return out;
}

// This point first, then its construction's other usage points, in their
// existing (CEFR-ascending) order — a construction can have dozens of
// siblings, so the matched one must stay visible without scrolling the pill
// row (grammar-usage-point-exercises plan, slice 1's design decision).
function buildSiblings(
  points: GrammarAnnotation['usagePoints'],
  matchedId: string,
): GrammarSiblingUsagePoint[] {
  const toSibling = (
    point: GrammarAnnotation['usagePoints'][number],
    matched: boolean,
  ): GrammarSiblingUsagePoint => ({
    id: point.grammarUsagePointId,
    guideword: point.guideword,
    canDoStatement: point.canDoStatement,
    explanation: point.explanation,
    translations: point.translations,
    examples: point.examples,
    matched,
  });
  const matched = points.find((p) => p.grammarUsagePointId === matchedId);
  const others = points.filter((p) => p.grammarUsagePointId !== matchedId);
  return matched
    ? [toSibling(matched, true), ...others.map((p) => toSibling(p, false))]
    : others.map((p) => toSibling(p, false));
}

// The popup data for every span `renderDoc` labels, whatever its state.
export function buildLexiconData(
  annotations: PostDetail['annotations'],
  exercises: PostDetail['exercises'],
): LexiconData {
  const contrast = contrastByUsagePoint(exercises);
  const data: LexiconData = { words: {}, phrases: {}, grammar: {} };
  for (const w of Object.values(annotations.words)) {
    if (w.pos === 'proper_noun') {
      continue;
    }
    data.words[w.wordDefinitionId] = {
      kind: 'word',
      id: w.wordDefinitionId,
      lemma: w.lemma,
      pos: w.pos,
      phonetic: w.phonetic,
      frequencyRank: w.frequencyRank,
      definition: w.definition,
      example: w.example,
      translations: w.translations,
      cefrLevel: w.cefrLevel,
      state: w.state,
    };
  }
  for (const p of Object.values(annotations.phrases)) {
    data.phrases[p.phraseId] = {
      kind: 'phrase',
      id: p.phraseId,
      text: p.text,
      type: p.type,
      definition: p.definition,
      example: p.example,
      translations: p.translations,
      cefrLevel: p.cefrLevel,
      state: p.state,
    };
  }
  // A usage point's viewer state rides on its matches; every match of one
  // point carries the same state.
  const stateOf = new Map(
    (annotations.grammarMatches ?? []).map((m) => [
      m.grammarUsagePointId,
      m.state,
    ]),
  );
  for (const construction of Object.values(annotations.grammar)) {
    for (const point of construction.usagePoints) {
      const state = stateOf.get(point.grammarUsagePointId);
      if (state) {
        data.grammar[point.grammarUsagePointId] = {
          id: point.grammarUsagePointId,
          construction: construction.name,
          cefrLevel: point.cefrLevel,
          guideword: point.guideword,
          canDoStatement: point.canDoStatement,
          explanation: point.explanation,
          translations: point.translations,
          examples: point.examples,
          contrast: contrast.get(point.grammarUsagePointId) ?? null,
          state,
          siblings: buildSiblings(
            construction.usagePoints,
            point.grammarUsagePointId,
          ),
        };
      }
    }
  }
  return data;
}
