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
const AUX_DEPS = new Set(['aux', 'auxpass']);

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

export type VerbAspect =
  | 'simple'
  | 'continuous'
  | 'perfect'
  | 'perfectContinuous';

export interface VerbGroupTense {
  // Unique among the groups returned by one detectVerbGroups call (i.e.
  // within one sentence), not across the whole document.
  verbGroupId: string;
  tense: TokenTense;
  aspect: VerbAspect;
  isGoingToFuture: boolean;
}

export interface AnalyzableSentenceToken extends AnalyzableToken {
  // Sentence-local token index (SentenceToken.position), used to key the
  // returned map and to walk headPosition edges.
  position: number;
  dep: string;
  headPosition?: number | null;
}

function childrenOf(
  tokens: AnalyzableSentenceToken[],
  position: number,
  deps: Set<string>,
): AnalyzableSentenceToken[] {
  return tokens.filter((t) => t.headPosition === position && deps.has(t.dep));
}

// "be going to VERB": a progressive `go` head with a `be` aux and an xcomp
// infinitive introduced by `to` — a fixed future phrase distinct from the
// tense+aspect grid below, taught to A1 readers as its own construction.
function detectGoingToFuture(
  tokens: AnalyzableSentenceToken[],
): Map<number, VerbGroupTense> {
  const groups = new Map<number, VerbGroupTense>();
  for (const going of tokens) {
    if (
      !VERB_POS.has(going.pos) ||
      going.tag !== 'VBG' ||
      going.lemma.toLowerCase() !== 'go'
    ) {
      continue;
    }
    const beAux = childrenOf(tokens, going.position, new Set(['aux'])).find(
      (t) => t.lemma.toLowerCase() === 'be',
    );
    const infinitive = tokens.find(
      (t) =>
        t.headPosition === going.position &&
        t.dep === 'xcomp' &&
        VERB_POS.has(t.pos),
    );
    const toMarker = infinitive
      ? tokens.find(
          (t) => t.headPosition === infinitive.position && t.tag === 'TO',
        )
      : undefined;
    if (!beAux || !infinitive || !toMarker) {
      continue;
    }
    const group: VerbGroupTense = {
      verbGroupId: `vg-${going.position}`,
      tense: 'future',
      aspect: 'simple',
      isGoingToFuture: true,
    };
    for (const member of [beAux, going, toMarker, infinitive]) {
      groups.set(member.position, group);
    }
  }
  return groups;
}

function auxChainTense(
  finite: AnalyzableSentenceToken,
  auxMembers: AnalyzableSentenceToken[],
): TokenTense | null {
  if (
    auxMembers.some((t) => t.tag === 'MD' && t.lemma.toLowerCase() === 'will')
  ) {
    return 'future';
  }
  if (finite.morph.Tense === 'Past') {
    return 'past';
  }
  return finite.morph.Tense === 'Pres' ? 'present' : null;
}

function auxChainAspect(
  auxMembers: AnalyzableSentenceToken[],
  isProgressiveForm: boolean,
): VerbAspect {
  const hasHaveAux = auxMembers.some((t) => t.lemma.toLowerCase() === 'have');
  const hasBeAux = auxMembers.some((t) => t.lemma.toLowerCase() === 'be');
  if (hasHaveAux) {
    return hasBeAux && isProgressiveForm ? 'perfectContinuous' : 'perfect';
  }
  return hasBeAux && isProgressiveForm ? 'continuous' : 'simple';
}

// A finite verb/modal plus its flat aux chain (e.g. "had" + "drawn"), and the
// one tense+aspect shared by every member — null when the clause carries no
// finite verb (a bare infinitive/gerund complement) or an indeterminate
// tense (neither `will` nor a Past/Pres morph feature).
function buildAuxChainGroup(
  head: AnalyzableSentenceToken,
  tokens: AnalyzableSentenceToken[],
): { members: AnalyzableSentenceToken[]; group: VerbGroupTense } | null {
  const auxMembers = childrenOf(tokens, head.position, AUX_DEPS);
  const members = [head, ...auxMembers];
  const finite = members.find((t) => t.morph.VerbForm === 'Fin');
  if (!finite) {
    return null;
  }
  const tense = auxChainTense(finite, auxMembers);
  if (!tense) {
    return null;
  }
  return {
    members,
    group: {
      verbGroupId: `vg-${head.position}`,
      tense,
      aspect: auxChainAspect(auxMembers, head.tag === 'VBG'),
      isGoingToFuture: false,
    },
  };
}

// One tense+aspect for every member of a verb group, keyed by each member's
// position, not just the finite token: "had drawn" reads as one Past
// Perfect group instead of a lone "had".
export function detectVerbGroups(
  tokens: AnalyzableSentenceToken[],
): Map<number, VerbGroupTense> {
  const groups = detectGoingToFuture(tokens);

  for (const head of tokens) {
    if (
      groups.has(head.position) ||
      !VERB_POS.has(head.pos) ||
      AUX_DEPS.has(head.dep)
    ) {
      continue;
    }
    const result = buildAuxChainGroup(head, tokens);
    if (!result) {
      continue;
    }
    for (const member of result.members) {
      groups.set(member.position, result.group);
    }
  }

  return groups;
}
