// View models for the reader's Quick check card: one step per screen, built
// from data the post page already has (exercises, lexicon, this post's due
// cards). Nothing here needs an extra API call.
import type { LexiconData } from './reader-lexicon';
import type { PostDetail, PracticeItem } from './types';

export interface ChooseStep {
  kind: 'choose';
  before: string;
  after: string;
  options: string[];
  answerIndex: number;
  explanations: string[];
}

export interface RecallStep {
  kind: 'recall';
  cardId: string;
  type: 'word' | 'phrase';
  term: string;
  phonetic: string | null;
  definition: string;
  context: string | null;
}

export interface MatchPair {
  id: string;
  term: string;
  meaning: string;
}

export interface MatchStep {
  kind: 'match';
  pairs: MatchPair[];
}

// Fill the blank (typed, optionally with a word bank) and find the error.
export interface TypeStep {
  kind: 'type';
  variant: 'fill_blank' | 'find_error';
  hint: string | null;
  before: string;
  after: string;
  answer: string;
  bank: string[];
}

export interface OrderStep {
  kind: 'order';
  tokens: string[];
  // order[slot] is the position the token at `slot` takes in the sentence.
  order: number[];
  answerText: string;
}

export type QuickCheckStep =
  | ChooseStep
  | RecallStep
  | MatchStep
  | TypeStep
  | OrderStep;

const MAX_CHOOSE = 5;
const MAX_DRILLS = 6;
const MAX_RECALL = 3;
const MIN_PAIRS = 3;
const MAX_PAIRS = 4;

function splitBlank(prompt: string): { before: string; after: string } {
  const i = prompt.indexOf('____');
  return i === -1
    ? { before: prompt, after: '' }
    : { before: prompt.slice(0, i), after: prompt.slice(i + 4) };
}

// Only constructions still marked for this viewer (new/learning) get a
// question.
function toChoose(
  exercise: PostDetail['exercises'][number],
  lexicon: LexiconData,
): ChooseStep | null {
  const p = exercise.payload;
  const pointId = p.grammarUsagePointId;
  if (
    exercise.type !== 'grammar_contrastive' ||
    typeof pointId !== 'string' ||
    !lexicon.grammar[pointId] ||
    typeof p.question !== 'string' ||
    !Array.isArray(p.options)
  ) {
    return null;
  }
  return {
    kind: 'choose',
    ...splitBlank(p.question),
    options: p.options as string[],
    answerIndex: Number(p.answerIndex ?? -1),
    explanations: Array.isArray(p.optionExplanations)
      ? (p.optionExplanations as string[])
      : [],
  };
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

// A spaCy drill (multiple_choice, fill_blank, find_error, reorder) as a step.
function toDrill(
  exercise: PostDetail['exercises'][number],
): QuickCheckStep | null {
  const p = exercise.payload;
  if (exercise.type === 'multiple_choice') {
    const answerIndex = Number(p.answerIndex ?? -1);
    if (
      typeof p.prompt !== 'string' ||
      !isStrings(p.options) ||
      !p.options[answerIndex]
    ) {
      return null;
    }
    return {
      kind: 'choose',
      ...splitBlank(p.prompt),
      options: p.options,
      answerIndex,
      explanations: [],
    };
  }
  if (exercise.type === 'fill_blank') {
    if (typeof p.prompt !== 'string' || typeof p.answer !== 'string') {
      return null;
    }
    return {
      kind: 'type',
      variant: 'fill_blank',
      hint: null,
      ...splitBlank(p.prompt),
      answer: p.answer,
      // Empty when the sentence had too few distractors.
      bank: isStrings(p.options) ? p.options : [],
    };
  }
  if (exercise.type === 'find_error') {
    if (typeof p.prompt !== 'string' || typeof p.correction !== 'string') {
      return null;
    }
    return {
      kind: 'type',
      variant: 'find_error',
      hint: 'One word is in the wrong form. Type the correct form.',
      before: p.prompt,
      after: '',
      answer: p.correction,
      bank: [],
    };
  }
  if (exercise.type === 'reorder') {
    const tokens = p.scrambled;
    const order = p.answer;
    if (
      !isStrings(tokens) ||
      !Array.isArray(order) ||
      order.length !== tokens.length ||
      tokens.length < 2
    ) {
      return null;
    }
    const answerText = tokens
      .map((token, slot) => ({ token, at: Number(order[slot]) }))
      .sort((a, b) => a.at - b.at)
      .map((t) => t.token)
      .join(' ');
    return { kind: 'order', tokens, order: order.map(Number), answerText };
  }
  return null;
}

// A due word/phrase card with something to reveal. Grammar cards already have
// the choose-the-form question.
function toRecall(item: PracticeItem): RecallStep | null {
  const { target } = item;
  if (
    (target.type !== 'word' && target.type !== 'phrase') ||
    !target.secondary
  ) {
    return null;
  }
  return {
    kind: 'recall',
    cardId: item.cardId,
    type: target.type,
    term: target.primary,
    phonetic: target.phonetic,
    definition: target.secondary,
    context: target.contextSentence,
  };
}

// Words and phrases the post marks for the viewer, each with a definition.
// Terms and meanings are unique so a pair has exactly one right answer.
function toMatch(lexicon: LexiconData): MatchStep | null {
  const candidates: MatchPair[] = [
    ...Object.values(lexicon.words).map((w) => ({
      id: `word:${w.id}`,
      term: w.lemma,
      meaning: w.definition ?? '',
    })),
    ...Object.values(lexicon.phrases).map((p) => ({
      id: `phrase:${p.id}`,
      term: p.text,
      meaning: p.definition ?? '',
    })),
  ];
  const seenTerms = new Set<string>();
  const seenMeanings = new Set<string>();
  const pairs: MatchPair[] = [];
  for (const pair of candidates) {
    if (
      !pair.meaning ||
      seenTerms.has(pair.term) ||
      seenMeanings.has(pair.meaning)
    ) {
      continue;
    }
    seenTerms.add(pair.term);
    seenMeanings.add(pair.meaning);
    pairs.push(pair);
    if (pairs.length === MAX_PAIRS) {
      break;
    }
  }
  return pairs.length >= MIN_PAIRS ? { kind: 'match', pairs } : null;
}

export function buildQuickCheckSteps(
  exercises: PostDetail['exercises'],
  lexicon: LexiconData,
  dueCards: PracticeItem[],
): QuickCheckStep[] {
  const choose = exercises
    .map((ex) => toChoose(ex, lexicon))
    .filter((s): s is ChooseStep => s !== null)
    .slice(0, MAX_CHOOSE);
  const recall = dueCards
    .map(toRecall)
    .filter((s): s is RecallStep => s !== null)
    .slice(0, MAX_RECALL);
  const match = toMatch(lexicon);
  const drills = exercises
    .map(toDrill)
    .filter((s): s is QuickCheckStep => s !== null)
    .slice(0, MAX_DRILLS);
  return [...choose, ...recall, ...(match ? [match] : []), ...drills];
}
