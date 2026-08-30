import type {
  NlpParseResult,
  NlpSentence,
  NlpToken,
} from '../../../core/nlp/nlp-client.port.js';
import { NlpOffsetMismatchError } from '../errors/nlp-offset-mismatch.error.js';

export interface BuiltToken {
  position: number;
  text: string;
  // Char offsets within the parent sentence's rawText.
  charStart: number;
  charEnd: number;
  lemma: string;
  pos: string;
  tag: string;
  dep: string;
  // Sentence-local index of the syntactic head, or null when the token is
  // its own root.
  headPosition: number | null;
  morph: Record<string, string>;
  isGerund: boolean;
  // Canonical phrasal-verb form ("pick up"), shared by the head verb token
  // and every particle fragment; null otherwise. The spacy_parse handler
  // resolves this to a Phrase row id (sentence_tokens.phrasal_verb_group_id).
  phrasalVerbKey: string | null;
}

export interface BuiltSentence {
  position: number;
  rawText: string;
  // Char offsets within the flattened unit's plain text.
  charStart: number;
  charEnd: number;
  tokens: BuiltToken[];
}

const ING_SUFFIX = /ing$/i;

// Dependency labels where an -ing form is standing in a noun slot. Verbal
// uses (xcomp, advcl, aux, ROOT, acl, ...) and adjectival uses (amod, acomp)
// are deliberately excluded — those are not gerunds.
const GERUND_DEPS = new Set([
  'nsubj',
  'nsubjpass',
  'csubj',
  'dobj',
  'obj',
  'iobj',
  'dative',
  'pobj',
  'attr',
  'oprd',
  'appos',
  'conj',
]);

function hasDeterminerChild(tokens: NlpToken[], index: number): boolean {
  return tokens.some((t) => t.head === index && t.dep === 'det');
}

// Common lexicalised -ing nouns. en_core_web_sm tags these `NN` in a bare
// nominal slot ("Morning comes early", "Nothing matters", "Spring is here"),
// which the NN branch below would otherwise mis-flag as a gerund (→ pos: verb
// in build-token-annotations). Only consulted for the NN case — a confident
// `VBG` tag is still trusted ("Meeting new people is fun").
const LEXICALISED_ING_NOUNS: ReadonlySet<string> = new Set([
  'morning',
  'evening',
  'ceiling',
  'building',
  'meeting',
  'wedding',
  'feeling',
  'warning',
  'opening',
  'beginning',
  'painting',
  'drawing',
  'meaning',
  'setting',
  'ending',
  'thing',
  'nothing',
  'something',
  'everything',
  'anything',
  'spring',
  'string',
  'king',
  'ring',
]);

// Deterministic gerund test (PLAN.md §12): an -ing surface form in a nominal
// dependency slot. en_core_web_sm tags a bare gerund subject as either VBG
// ("Reading is fundamental") or NN ("Swimming is good"); the NN case is only
// a gerund when it has no determiner of its own ("the meeting" / "the
// building" are plain nouns).
export function detectGerund(token: NlpToken, tokens: NlpToken[]): boolean {
  if (!ING_SUFFIX.test(token.text)) {
    return false;
  }
  if (!GERUND_DEPS.has(token.dep)) {
    return false;
  }
  if (token.tag === 'VBG') {
    return true;
  }
  if (token.tag !== 'NN' || hasDeterminerChild(tokens, token.index)) {
    return false;
  }
  return !LEXICALISED_ING_NOUNS.has(token.text.toLowerCase());
}

function isParticle(token: NlpToken): boolean {
  return token.dep === 'prt' || token.tag === 'RP';
}

// Groups each discontinuous phrasal verb ("turned" ... "down") by mapping
// every particle to its head verb via the dependency edge, then builds a
// canonical key from the verb lemma + particle surface forms in reading
// order. Returns one key (or null) per token, indexed by token position.
export function computePhrasalVerbKeys(tokens: NlpToken[]): (string | null)[] {
  const keys: (string | null)[] = tokens.map(() => null);
  const particlesByVerb = new Map<number, number[]>();

  for (const token of tokens) {
    if (!isParticle(token) || token.head === token.index) {
      continue;
    }
    const verb = tokens[token.head];
    if (!verb || (verb.pos !== 'VERB' && verb.pos !== 'AUX')) {
      continue;
    }
    const group = particlesByVerb.get(verb.index) ?? [];
    group.push(token.index);
    particlesByVerb.set(verb.index, group);
  }

  for (const [verbIndex, particleIndexes] of particlesByVerb) {
    const ordered = [...particleIndexes].sort((a, b) => a - b);
    const key = [
      tokens[verbIndex].lemma.toLowerCase(),
      ...ordered.map((i) => tokens[i].text.toLowerCase()),
    ].join(' ');

    keys[verbIndex] = key;
    for (const i of ordered) {
      keys[i] = key;
    }
  }

  return keys;
}

function buildToken(
  token: NlpToken,
  tokens: NlpToken[],
  sentenceText: string,
  phrasalVerbKey: string | null,
): BuiltToken {
  if (sentenceText.slice(token.start, token.end) !== token.text) {
    throw new NlpOffsetMismatchError(
      `token "${token.text}" at ${token.start}..${token.end} does not match sentence slice "${sentenceText.slice(token.start, token.end)}"`,
    );
  }

  return {
    position: token.index,
    text: token.text,
    charStart: token.start,
    charEnd: token.end,
    lemma: token.lemma,
    pos: token.pos,
    tag: token.tag,
    dep: token.dep,
    headPosition: token.head === token.index ? null : token.head,
    morph: token.morph ?? {},
    isGerund: detectGerund(token, tokens),
    phrasalVerbKey,
  };
}

function buildSentence(
  sentence: NlpSentence,
  position: number,
  unitText: string,
): BuiltSentence {
  if (unitText.slice(sentence.start, sentence.end) !== sentence.text) {
    throw new NlpOffsetMismatchError(
      `sentence at ${sentence.start}..${sentence.end} does not match unit slice`,
    );
  }

  const phrasalVerbKeys = computePhrasalVerbKeys(sentence.tokens);

  return {
    position,
    rawText: sentence.text,
    charStart: sentence.start,
    charEnd: sentence.end,
    tokens: sentence.tokens.map((token, i) =>
      buildToken(token, sentence.tokens, sentence.text, phrasalVerbKeys[i]),
    ),
  };
}

// Maps one nlp-service response for a single flattened text unit into the
// rows the spacy_parse stage persists, validating every offset first
// (PLAN.md §12 all-or-nothing).
export function buildSentences(
  unitText: string,
  result: NlpParseResult,
): BuiltSentence[] {
  return result.sentences.map((sentence, position) =>
    buildSentence(sentence, position, unitText),
  );
}
