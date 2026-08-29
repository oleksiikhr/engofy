import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';
import type { Annotation } from './validate-annotations.js';

// One spaCy token, as persisted in sentence_tokens (only the fields this
// builder reads).
export interface TokenRow {
  text: string;
  // Char offsets within the parent sentence's rawText.
  charStart: number;
  charEnd: number;
  lemma: string;
  // Raw spaCy UPOS (token.pos_).
  pos: string;
  isGerund: boolean;
  // phrases.id shared by every fragment of one phrasal verb, grouped
  // deterministically by spacy_parse; null for a plain token.
  phrasalVerbGroupId: string | null;
}

// One sentence of a flattened unit, with its ordered tokens.
export interface SentenceRows {
  // Char offset of this sentence within the flattened unit's plain text.
  charStart: number;
  tokens: TokenRow[];
}

// spaCy UPOS -> the curated PartOfSpeech used on WordDefinition and the
// node-tree `word` span. Only the content classes the annotation layer tags
// (mirrors the old prompt's "every noun, proper noun, verb, adjective,
// adverb"); everything else — AUX, DET, ADP, PRON, PART, PUNCT, NUM, SCONJ,
// CCONJ, … — is left untagged.
const CONTENT_POS: Record<string, PartOfSpeech> = {
  NOUN: PartOfSpeech.Noun,
  PROPN: PartOfSpeech.ProperNoun,
  VERB: PartOfSpeech.Verb,
  ADJ: PartOfSpeech.Adjective,
  ADV: PartOfSpeech.Adverb,
};

// Builds the deterministic half of the annotation layer straight from the
// spaCy tokens: a `word` annotation per content-word token and a `phrase`
// annotation (phrasal_verb, one fragment per token) per
// phrasal_verb_group_id. Offsets are in the flattened unit's coordinate
// system (sentence.charStart + token.charStart), the same one
// flattenParagraph / spliceSpans use. The LLM adds only idioms/collocations
// on top of this (see annotation-prompt.ts).
export function buildTokenAnnotations(
  sentences: SentenceRows[],
  phraseTextById: Map<string, string>,
): Annotation[] {
  const words: Annotation[] = [];
  const phraseFragments: Annotation[] = [];

  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      const start = sentence.charStart + token.charStart;
      const end = sentence.charStart + token.charEnd;

      if (token.phrasalVerbGroupId) {
        phraseFragments.push({
          start,
          end,
          form: token.text,
          kind: 'phrase',
          phraseType: PhraseType.PhrasalVerb,
          phraseText: phraseTextById.get(token.phrasalVerbGroupId) ?? '',
          phraseGroupId: token.phrasalVerbGroupId,
          phraseId: token.phrasalVerbGroupId,
        });
        continue;
      }

      const pos = token.isGerund ? PartOfSpeech.Verb : CONTENT_POS[token.pos];
      if (!pos) {
        continue;
      }

      words.push({
        start,
        end,
        form: token.text,
        kind: 'word',
        lemma: token.lemma,
        pos,
      });
    }
  }

  return [...words, ...phraseFragments].sort((a, b) => a.start - b.start);
}
