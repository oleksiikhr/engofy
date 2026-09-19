import type { LexiconData } from './reader-lexicon';
import { isMarked } from './render-doc';
import type { PostDetail } from './types';

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

// The popup data for the spans `renderDoc` marks: only new/learning
// word/phrase/grammar annotations, so the JSON embedded in the page stays
// small.
export function buildLexiconData(
  annotations: PostDetail['annotations'],
  exercises: PostDetail['exercises'],
): LexiconData {
  const contrast = contrastByUsagePoint(exercises);
  const data: LexiconData = { words: {}, phrases: {}, grammar: {} };
  for (const w of Object.values(annotations.words)) {
    if (isMarked(w.state)) {
      data.words[w.wordDefinitionId] = {
        kind: 'word',
        id: w.wordDefinitionId,
        lemma: w.lemma,
        pos: w.pos,
        phonetic: w.phonetic,
        definition: w.definition,
        example: w.example,
        cefrLevel: w.cefrLevel,
        state: w.state,
      };
    }
  }
  for (const p of Object.values(annotations.phrases)) {
    if (isMarked(p.state)) {
      data.phrases[p.phraseId] = {
        kind: 'phrase',
        id: p.phraseId,
        text: p.text,
        type: p.type,
        definition: p.definition,
        example: p.example,
        cefrLevel: p.cefrLevel,
        state: p.state,
      };
    }
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
      if (state && isMarked(state)) {
        data.grammar[point.grammarUsagePointId] = {
          id: point.grammarUsagePointId,
          construction: construction.name,
          cefrLevel: point.cefrLevel,
          guideword: point.guideword,
          canDoStatement: point.canDoStatement,
          exampleText: point.exampleText,
          contrast: contrast.get(point.grammarUsagePointId) ?? null,
          state,
        };
      }
    }
  }
  return data;
}
