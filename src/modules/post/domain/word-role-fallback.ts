export interface WordRoleFallback {
  posLabel: string;
  roleHint: string;
}

interface RoleToken {
  pos: string;
  tag: string;
  lemma: string;
}

// Generic description per spaCy UPOS tag, used when no lemma-specific entry
// below matches. Short, A1-appropriate phrasing — this is a lightweight
// fallback, not a dictionary entry (PLAN.md, slice 2).
const POS_ROLE: Record<string, WordRoleFallback> = {
  NOUN: { posLabel: 'noun', roleHint: 'names a person, place, thing, or idea' },
  PROPN: {
    posLabel: 'proper noun',
    roleHint: 'names one specific person, place, or thing',
  },
  VERB: { posLabel: 'verb', roleHint: 'names an action or a state' },
  AUX: {
    posLabel: 'auxiliary verb',
    roleHint: 'helps the main verb build its tense, question, or negative form',
  },
  ADJ: { posLabel: 'adjective', roleHint: 'describes a noun' },
  ADV: {
    posLabel: 'adverb',
    roleHint: 'describes a verb, an adjective, or another adverb',
  },
  PRON: {
    posLabel: 'pronoun',
    roleHint: 'stands in for a noun already mentioned',
  },
  DET: {
    posLabel: 'determiner',
    roleHint: 'comes before a noun and shows which one is meant',
  },
  ADP: {
    posLabel: 'preposition',
    roleHint: 'links a noun to the rest of the sentence, often place or time',
  },
  CCONJ: {
    posLabel: 'conjunction',
    roleHint: 'joins two equal words, phrases, or clauses',
  },
  SCONJ: {
    posLabel: 'conjunction',
    roleHint: 'introduces a clause that depends on the main clause',
  },
  PART: {
    posLabel: 'particle',
    roleHint: 'a small function word attached to a verb or a negation',
  },
  NUM: { posLabel: 'number', roleHint: 'gives a quantity or an amount' },
  INTJ: {
    posLabel: 'interjection',
    roleHint: "an exclamation, standing outside the sentence's grammar",
  },
};

// The highest-frequency function words get a lemma+POS-specific hint instead
// of the generic POS.role above — e.g. "to" needs a different explanation as
// an infinitive marker (PART) than as a preposition (ADP), and "the"/"a" read
// better as "definite/indefinite article" than the generic "determiner".
const LEMMA_ROLE: Record<string, WordRoleFallback> = {
  'DET|the': {
    posLabel: 'definite article',
    roleHint: 'points to one specific, already-known thing',
  },
  'DET|a': {
    posLabel: 'indefinite article',
    roleHint: 'introduces a thing for the first time, one of several',
  },
  'DET|an': {
    posLabel: 'indefinite article',
    roleHint: 'introduces a thing for the first time, one of several',
  },
  'PART|to': {
    posLabel: 'infinitive marker',
    roleHint: 'introduces the base form of a following verb ("to go")',
  },
  'ADP|to': {
    posLabel: 'preposition',
    roleHint: 'shows direction or a recipient ("give it to me")',
  },
  'CCONJ|and': {
    posLabel: 'conjunction',
    roleHint: 'adds one item or idea to another',
  },
  'CCONJ|or': {
    posLabel: 'conjunction',
    roleHint: 'shows a choice between two items or ideas',
  },
  'CCONJ|but': {
    posLabel: 'conjunction',
    roleHint: 'contrasts one idea with another',
  },
  'ADP|of': {
    posLabel: 'preposition',
    roleHint: 'shows belonging or being part of something',
  },
  'ADP|in': {
    posLabel: 'preposition',
    roleHint: 'shows location inside a place, or a point in time',
  },
  'ADP|on': {
    posLabel: 'preposition',
    roleHint: 'shows a surface, a day, or a date',
  },
  'ADP|at': {
    posLabel: 'preposition',
    roleHint: 'shows a precise place or time',
  },
  'ADP|for': {
    posLabel: 'preposition',
    roleHint: 'shows purpose, or who something is meant for',
  },
  'ADP|with': {
    posLabel: 'preposition',
    roleHint: 'shows accompaniment or a tool used',
  },
  'PART|not': {
    posLabel: 'negation',
    roleHint: 'makes the verb before it negative',
  },
  'SCONJ|that': {
    posLabel: 'conjunction',
    roleHint: 'introduces a clause that explains or reports something',
  },
  'PRON|it': {
    posLabel: 'pronoun',
    roleHint: 'stands in for a thing already mentioned, or a dummy subject',
  },
};

// A short, human-readable part-of-speech label plus a typical sentence role
// for a token with no `word_definition`/`phrase` entry — null for a POS this
// module doesn't cover (PUNCT/SPACE are filtered out before this is called;
// any other unmapped UPOS tag falls through to null rather than guessing).
export function describeWordRole(token: RoleToken): WordRoleFallback | null {
  const generic = POS_ROLE[token.pos];
  if (!generic) {
    return null;
  }
  return LEMMA_ROLE[`${token.pos}|${token.lemma.toLowerCase()}`] ?? generic;
}
