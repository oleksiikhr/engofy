import type { LexiconData } from './reader-lexicon';
import { isMarked } from './render-doc';
import type { PostDetail } from './types';

// The popup data for the spans `renderDoc` marks: only new/learning
// word/phrase annotations, so the JSON embedded in the page stays small.
export function buildLexiconData(
  annotations: PostDetail['annotations'],
): LexiconData {
  const data: LexiconData = { words: {}, phrases: {} };
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
  return data;
}
