import { ExerciseSource } from '../enums/exercise-source.enum.js';
import { ExerciseType } from '../enums/exercise-type.enum.js';

// Deterministic exercise generation from the spaCy layer (PLAN.md §5
// `ai_exercises`, §3.10): the bulk of exercises are built here straight from
// `sentence_tokens` with no AI call. Comprehension questions — the one type
// that needs real understanding of the passage — are the AI's job and are
// added by the handler, not this module.

// spaCy UPOS tags that carry lexical meaning worth practising.
const CONTENT_POS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);
const WORD_RE = /^[A-Za-z][A-Za-z-]*$/;
const IRREGULAR_BE_HAVE_DO = new Set(['be', 'have', 'do']);
const BLANK = '____';

// Per-type ceiling so a long post doesn't produce hundreds of near-identical
// drills. The handler passes sentences in document order, so the first N of
// each type win.
const DEFAULT_MAX_PER_TYPE = 8;
const REORDER_MIN_TOKENS = 5;
const REORDER_MAX_TOKENS = 14;
const MIN_WORD_LENGTH = 3;
const MC_DISTRACTORS = 3;

export interface ExerciseTokenInput {
  position: number;
  text: string;
  // Char offsets within the parent sentence's rawText.
  charStart: number;
  charEnd: number;
  lemma: string;
  // Raw spaCy UPOS / Penn tag.
  pos: string;
  tag: string;
}

export interface ExerciseSentenceInput {
  id: string;
  rawText: string;
  tokens: ExerciseTokenInput[];
}

export interface FillBlankPayload {
  sentenceId: string;
  prompt: string;
  answer: string;
  lemma: string;
  tokenPosition: number;
}

export interface ReorderPayload {
  sentenceId: string;
  // Token surface forms in a scrambled but deterministic order.
  scrambled: string[];
  // For each slot of `scrambled`, the index it must move to for the original
  // sentence order (answer[i] = target position of scrambled[i]).
  answer: number[];
}

export interface MultipleChoicePayload {
  sentenceId: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  tokenPosition: number;
}

export interface FindErrorPayload {
  sentenceId: string;
  // The sentence with one word replaced by an incorrect form.
  prompt: string;
  tokenPosition: number;
  incorrectForm: string;
  correction: string;
}

export type ExerciseDraft =
  | {
      type: ExerciseType.FillBlank;
      source: ExerciseSource.Spacy;
      payload: FillBlankPayload;
    }
  | {
      type: ExerciseType.Reorder;
      source: ExerciseSource.Spacy;
      payload: ReorderPayload;
    }
  | {
      type: ExerciseType.MultipleChoice;
      source: ExerciseSource.Spacy;
      payload: MultipleChoicePayload;
    }
  | {
      type: ExerciseType.FindError;
      source: ExerciseSource.Spacy;
      payload: FindErrorPayload;
    };

export interface BuildExercisesOptions {
  maxPerType?: number;
}

// mulberry32 seeded from the sentence id — a stable scramble per sentence, so
// re-running the stage produces the same exercises (the handler still deletes
// and rebuilds, but a stable output keeps diffs readable).
function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) | 0;
    let t = (state ^ (state >>> 7)) >>> 0;
    t = (t >>> 0) / 4294967296;
    const j = Math.floor(t * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function isContentWord(token: ExerciseTokenInput): boolean {
  return (
    CONTENT_POS.has(token.pos) &&
    WORD_RE.test(token.text) &&
    token.text.length >= MIN_WORD_LENGTH
  );
}

// First blank-able content word that is neither the opening nor the closing
// token (those give away too much / too little context).
function pickTarget(
  sentence: ExerciseSentenceInput,
): ExerciseTokenInput | undefined {
  const { tokens } = sentence;
  for (let i = 1; i < tokens.length - 1; i += 1) {
    if (isContentWord(tokens[i])) {
      return tokens[i];
    }
  }
  return undefined;
}

function spliceSentence(
  sentence: ExerciseSentenceInput,
  token: ExerciseTokenInput,
  replacement: string,
): string {
  return (
    sentence.rawText.slice(0, token.charStart) +
    replacement +
    sentence.rawText.slice(token.charEnd)
  );
}

function buildFillBlank(
  sentence: ExerciseSentenceInput,
): FillBlankPayload | undefined {
  const token = pickTarget(sentence);
  if (!token) {
    return undefined;
  }
  return {
    sentenceId: sentence.id,
    prompt: spliceSentence(sentence, token, BLANK),
    answer: token.text,
    lemma: token.lemma,
    tokenPosition: token.position,
  };
}

function buildReorder(
  sentence: ExerciseSentenceInput,
): ReorderPayload | undefined {
  const forms = sentence.tokens.map((t) => t.text);
  if (forms.length < REORDER_MIN_TOKENS || forms.length > REORDER_MAX_TOKENS) {
    return undefined;
  }

  const order = seededShuffle(
    forms.map((_, i) => i),
    hashSeed(sentence.id),
  );
  // A shuffle that landed back on the original order is not an exercise.
  if (order.every((originalIndex, slot) => originalIndex === slot)) {
    return undefined;
  }

  const scrambled = order.map((originalIndex) => forms[originalIndex]);
  // answer[slot] = where the token now in `slot` belongs in the original.
  const answer = order.slice();
  return { sentenceId: sentence.id, scrambled, answer };
}

function buildMultipleChoice(
  sentence: ExerciseSentenceInput,
  distractorPool: Map<string, string[]>,
): MultipleChoicePayload | undefined {
  const token = pickTarget(sentence);
  if (!token) {
    return undefined;
  }

  const answerLemma = token.lemma.toLowerCase();
  const candidates = (distractorPool.get(`${token.pos}|${token.tag}`) ?? [])
    .filter((form) => form.toLowerCase() !== token.text.toLowerCase())
    .filter((form) => form.toLowerCase() !== answerLemma);

  const distractors: string[] = [];
  const seen = new Set([token.text.toLowerCase()]);
  for (const form of candidates) {
    const key = form.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    distractors.push(form);
    if (distractors.length === MC_DISTRACTORS) {
      break;
    }
  }
  if (distractors.length < MC_DISTRACTORS) {
    return undefined;
  }

  const options = seededShuffle(
    [token.text, ...distractors],
    hashSeed(`${sentence.id}:mc`),
  );
  return {
    sentenceId: sentence.id,
    prompt: spliceSentence(sentence, token, BLANK),
    options,
    answerIndex: options.indexOf(token.text),
    tokenPosition: token.position,
  };
}

// Deterministic error injection: a regular finite past-tense main verb
// (`VBD`, UPOS `VERB`) demoted to its base form — "she moved" -> "she move".
// Restricted to regular verbs whose lemma differs from the surface form and
// is not be/have/do, so the result is a clean, unambiguous mistake.
function buildFindError(
  sentence: ExerciseSentenceInput,
): FindErrorPayload | undefined {
  for (const token of sentence.tokens) {
    if (token.pos !== 'VERB' || token.tag !== 'VBD') {
      continue;
    }
    const lemma = token.lemma.toLowerCase();
    if (
      !WORD_RE.test(lemma) ||
      lemma.length < MIN_WORD_LENGTH ||
      lemma === token.text.toLowerCase() ||
      IRREGULAR_BE_HAVE_DO.has(lemma)
    ) {
      continue;
    }

    const startsSentence = token.charStart === 0;
    const incorrectForm = startsSentence
      ? lemma.charAt(0).toUpperCase() + lemma.slice(1)
      : lemma;
    return {
      sentenceId: sentence.id,
      prompt: spliceSentence(sentence, token, incorrectForm),
      tokenPosition: token.position,
      incorrectForm,
      correction: token.text,
    };
  }
  return undefined;
}

function buildDistractorPool(
  sentences: ExerciseSentenceInput[],
): Map<string, string[]> {
  const pool = new Map<string, string[]>();
  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      if (!isContentWord(token)) {
        continue;
      }
      const key = `${token.pos}|${token.tag}`;
      const list = pool.get(key) ?? [];
      list.push(token.text);
      pool.set(key, list);
    }
  }
  return pool;
}

// Runs one generator over the sentences in document order until `maxPerType`
// drafts are collected.
function collect<P>(
  sentences: ExerciseSentenceInput[],
  maxPerType: number,
  build: (sentence: ExerciseSentenceInput) => P | undefined,
  wrap: (payload: P) => ExerciseDraft,
): ExerciseDraft[] {
  const drafts: ExerciseDraft[] = [];
  for (const sentence of sentences) {
    if (drafts.length >= maxPerType) {
      break;
    }
    const payload = build(sentence);
    if (payload) {
      drafts.push(wrap(payload));
    }
  }
  return drafts;
}

// Runs every deterministic generator over the post's sentences and returns
// the drafts in a stable order (all fill-blanks, then reorders, then MC, then
// find-error), each type capped. The handler turns these into Exercise rows
// and appends AI comprehension exercises separately.
export function buildExercises(
  sentences: ExerciseSentenceInput[],
  options: BuildExercisesOptions = {},
): ExerciseDraft[] {
  const maxPerType = options.maxPerType ?? DEFAULT_MAX_PER_TYPE;
  const distractorPool = buildDistractorPool(sentences);

  return [
    ...collect(sentences, maxPerType, buildFillBlank, (payload) => ({
      type: ExerciseType.FillBlank,
      source: ExerciseSource.Spacy,
      payload,
    })),
    ...collect(sentences, maxPerType, buildReorder, (payload) => ({
      type: ExerciseType.Reorder,
      source: ExerciseSource.Spacy,
      payload,
    })),
    ...collect(
      sentences,
      maxPerType,
      (sentence) => buildMultipleChoice(sentence, distractorPool),
      (payload) => ({
        type: ExerciseType.MultipleChoice,
        source: ExerciseSource.Spacy,
        payload,
      }),
    ),
    ...collect(sentences, maxPerType, buildFindError, (payload) => ({
      type: ExerciseType.FindError,
      source: ExerciseSource.Spacy,
      payload,
    })),
  ];
}
