// Sentence boundaries of a plain-text unit (a paragraph, a list item), used by
// read-aloud: a paragraph is spoken sentence by sentence, and a clicked label
// reads only the sentence it sits in.

export interface Sentence {
  text: string;
  start: number;
}

const FALLBACK = /[^.!?]+(?:[.!?]+["'’”)\]]*|$)\s*/g;

function segments(text: string): Sentence[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    return Array.from(segmenter.segment(text), (part) => ({
      text: part.segment,
      start: part.index,
    }));
  }
  return Array.from(text.matchAll(FALLBACK), (match) => ({
    text: match[0],
    start: match.index ?? 0,
  }));
}

// Segmenters end a sentence after these.
const ABBREVIATION = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|vs)\.\s*$/;

function mergeAbbreviations(parts: Sentence[]): Sentence[] {
  const merged: Sentence[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (previous && ABBREVIATION.test(previous.text)) {
      previous.text += part.text;
    } else {
      merged.push({ ...part });
    }
  }
  return merged;
}

export function splitSentences(text: string): Sentence[] {
  return mergeAbbreviations(segments(text)).filter(
    (sentence) => sentence.text.trim() !== '',
  );
}

// The sentence covering the character at `offset`; a boundary space belongs to
// the sentence before it.
export function sentenceAt(text: string, offset: number): string {
  const sentences = splitSentences(text);
  const hit =
    sentences.find(
      (sentence) =>
        offset >= sentence.start &&
        offset < sentence.start + sentence.text.length,
    ) ?? sentences[sentences.length - 1];
  return hit ? hit.text.trim() : '';
}
