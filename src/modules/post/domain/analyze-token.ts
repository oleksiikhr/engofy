import type { IrregularVerbEntry } from './irregular-verb.js';

export type TokenTense = 'past' | 'present' | 'future';

export interface IrregularVerbForms {
  base: string;
  pastSimple: string[];
  pastParticiple: string[];
}

export interface AnalyzableToken {
  text: string;
  lemma: string;
  pos: string;
  tag: string;
  morph: Record<string, string>;
}

const VERB_POS = new Set(['VERB', 'AUX']);

// Tense of a finite verb, read straight from spaCy's morphology; `will` (the
// modal, Penn tag MD) marks the future. Non-finite forms (infinitive,
// participle, gerund) carry no tense here.
export function tokenTense(token: AnalyzableToken): TokenTense | null {
  if (!VERB_POS.has(token.pos)) {
    return null;
  }
  if (token.tag === 'MD' && token.lemma.toLowerCase() === 'will') {
    return 'future';
  }
  if (token.morph.VerbForm !== 'Fin') {
    return null;
  }
  if (token.morph.Tense === 'Past') {
    return 'past';
  }
  return token.morph.Tense === 'Pres' ? 'present' : null;
}

// The irregular-verb entry a token's surface form belongs to: a verb whose
// lemma is on the list and whose text is one of its irregular past forms
// (the base form itself is not flagged).
export function tokenIrregularForms(
  token: AnalyzableToken,
  irregularByLemma: Map<string, IrregularVerbEntry>,
): IrregularVerbForms | null {
  if (!VERB_POS.has(token.pos)) {
    return null;
  }
  const entry = irregularByLemma.get(token.lemma.toLowerCase());
  const surface = token.text.toLowerCase();
  if (
    !entry ||
    !(
      entry.past_simple.includes(surface) ||
      entry.past_participle.includes(surface)
    )
  ) {
    return null;
  }
  return {
    base: entry.base_form,
    pastSimple: entry.past_simple,
    pastParticiple: entry.past_participle,
  };
}
