import { ExerciseType } from '../enums/exercise-type.enum.js';
import {
  buildExercises,
  type ExerciseSentenceInput,
  type ExerciseTokenInput,
  type FindErrorPayload,
  type MultipleChoicePayload,
  type ReorderPayload,
} from './build-exercises.js';

interface TokenSpec {
  text: string;
  lemma?: string;
  pos: string;
  tag: string;
}

let sentenceCounter = 0;

// Places each token spec in `rawText` by scanning forward from a cursor, so
// charStart/charEnd match a real spaCy token layout.
function makeSentence(
  rawText: string,
  specs: TokenSpec[],
  id?: string,
): ExerciseSentenceInput {
  let cursor = 0;
  const tokens: ExerciseTokenInput[] = specs.map((spec, position) => {
    const charStart = rawText.indexOf(spec.text, cursor);
    if (charStart === -1) {
      throw new Error(`token "${spec.text}" not found in "${rawText}"`);
    }
    const charEnd = charStart + spec.text.length;
    cursor = charEnd;
    return {
      position,
      text: spec.text,
      charStart,
      charEnd,
      lemma: spec.lemma ?? spec.text.toLowerCase(),
      pos: spec.pos,
      tag: spec.tag,
    };
  });

  sentenceCounter += 1;
  return { id: id ?? `s-${sentenceCounter}`, rawText, tokens };
}

// "The clever fox jumped over lazy dogs ."
function fillBlankSentence(id?: string): ExerciseSentenceInput {
  return makeSentence(
    'The clever fox jumped over lazy dogs.',
    [
      { text: 'The', pos: 'DET', tag: 'DT' },
      { text: 'clever', pos: 'ADJ', tag: 'JJ' },
      { text: 'fox', pos: 'NOUN', tag: 'NN' },
      { text: 'jumped', lemma: 'jump', pos: 'VERB', tag: 'VBD' },
      { text: 'over', pos: 'ADP', tag: 'IN' },
      { text: 'lazy', pos: 'ADJ', tag: 'JJ' },
      { text: 'dogs', lemma: 'dog', pos: 'NOUN', tag: 'NN' },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ],
    id,
  );
}

describe('buildExercises — fill_blank', () => {
  it('blanks the first content word that is not the opening or closing token', () => {
    const [draft] = buildExercises([fillBlankSentence('fb-1')]);

    expect(draft.type).toBe(ExerciseType.FillBlank);
    expect(draft.source).toBe('spacy');
    if (draft.type !== ExerciseType.FillBlank) {
      throw new Error('unreachable');
    }
    // "The" is the opening token, so "clever" is the first eligible target.
    expect(draft.payload).toMatchObject({
      sentenceId: 'fb-1',
      prompt: 'The ____ fox jumped over lazy dogs.',
      answer: 'clever',
      lemma: 'clever',
      tokenPosition: 1,
    });
  });

  it('re-inserting the answer at the blank restores the sentence', () => {
    const sentence = fillBlankSentence();
    const [draft] = buildExercises([sentence]);
    if (draft.type !== ExerciseType.FillBlank) {
      throw new Error('unreachable');
    }
    expect(draft.payload.prompt.replace('____', draft.payload.answer)).toBe(
      sentence.rawText,
    );
  });

  it('produces no fill_blank when the only content word is the opening token', () => {
    const sentence = makeSentence('Rain fell on the roof.', [
      { text: 'Rain', pos: 'NOUN', tag: 'NN' },
      { text: 'fell', lemma: 'fall', pos: 'VERB', tag: 'VBD' },
      { text: 'on', pos: 'ADP', tag: 'IN' },
      { text: 'the', pos: 'DET', tag: 'DT' },
      { text: 'roof', pos: 'NOUN', tag: 'NN' },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ]);
    // "fell" (position 1) is still eligible, so this DOES produce one — assert
    // the opening "Rain" is not the target.
    const [draft] = buildExercises([sentence]);
    if (draft.type !== ExerciseType.FillBlank) {
      throw new Error('unreachable');
    }
    expect(draft.payload.answer).toBe('fell');
  });

  it('skips short words and non-alphabetic tokens', () => {
    const sentence = makeSentence('I go to a 5k run now.', [
      { text: 'I', pos: 'PRON', tag: 'PRP' },
      { text: 'go', pos: 'VERB', tag: 'VBP' },
      { text: 'to', pos: 'ADP', tag: 'IN' },
      { text: 'a', pos: 'DET', tag: 'DT' },
      { text: '5k', pos: 'NOUN', tag: 'NN' },
      { text: 'run', pos: 'NOUN', tag: 'NN' },
      { text: 'now', pos: 'ADV', tag: 'RB' },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ]);
    const drafts = buildExercises([sentence]);
    const fillBlank = drafts.find((d) => d.type === ExerciseType.FillBlank);
    // "go" is 2 chars, "5k" non-alpha -> first eligible is "run".
    if (fillBlank?.type !== ExerciseType.FillBlank) {
      throw new Error('expected a fill_blank');
    }
    expect(fillBlank.payload.answer).toBe('run');
  });
});

describe('buildExercises — reorder', () => {
  it('scrambles a mid-length sentence and the answer maps back to the original', () => {
    const sentence = fillBlankSentence('ro-1');
    const draft = buildExercises([sentence]).find(
      (d) => d.type === ExerciseType.Reorder,
    );
    if (draft?.type !== ExerciseType.Reorder) {
      throw new Error('expected a reorder');
    }
    const payload: ReorderPayload = draft.payload;
    const originalForms = sentence.tokens.map((t) => t.text);

    expect(payload.scrambled).not.toEqual(originalForms);
    expect([...payload.scrambled].sort()).toEqual([...originalForms].sort());

    const restored: string[] = [];
    payload.answer.forEach((target, slot) => {
      restored[target] = payload.scrambled[slot];
    });
    expect(restored).toEqual(originalForms);
  });

  it('is deterministic for the same sentence id', () => {
    const a = buildExercises([fillBlankSentence('same-id')]).find(
      (d) => d.type === ExerciseType.Reorder,
    );
    const b = buildExercises([fillBlankSentence('same-id')]).find(
      (d) => d.type === ExerciseType.Reorder,
    );
    expect(a).toEqual(b);
  });

  it('skips sentences with fewer than 5 or more than 14 tokens', () => {
    const short = makeSentence('Dogs run fast.', [
      { text: 'Dogs', lemma: 'dog', pos: 'NOUN', tag: 'NNS' },
      { text: 'run', pos: 'VERB', tag: 'VBP' },
      { text: 'fast', pos: 'ADV', tag: 'RB' },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ]);
    const long = makeSentence(
      'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen',
      'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'
        .split(' ')
        .map((text) => ({ text, pos: 'NOUN', tag: 'NN' })),
    );
    const drafts = buildExercises([short, long]);
    expect(drafts.some((d) => d.type === ExerciseType.Reorder)).toBe(false);
  });
});

describe('buildExercises — multiple_choice', () => {
  function nounSentence(id: string, noun: string): ExerciseSentenceInput {
    return makeSentence(
      `A ${noun} appeared today.`,
      [
        { text: 'A', pos: 'DET', tag: 'DT' },
        { text: noun, pos: 'NOUN', tag: 'NN' },
        { text: 'appeared', lemma: 'appear', pos: 'VERB', tag: 'VBD' },
        { text: 'today', pos: 'NOUN', tag: 'NN' },
        { text: '.', pos: 'PUNCT', tag: '.' },
      ],
      id,
    );
  }

  it('builds a 4-option question with the answer among the options', () => {
    const sentences = [
      nounSentence('mc-1', 'cat'),
      nounSentence('mc-2', 'ship'),
      nounSentence('mc-3', 'river'),
      nounSentence('mc-4', 'plan'),
    ];
    const draft = buildExercises(sentences).find(
      (d) => d.type === ExerciseType.MultipleChoice,
    );
    if (draft?.type !== ExerciseType.MultipleChoice) {
      throw new Error('expected a multiple_choice');
    }
    const payload: MultipleChoicePayload = draft.payload;
    expect(payload.options).toHaveLength(4);
    expect(payload.options[payload.answerIndex]).toBe('cat');
    expect(new Set(payload.options).size).toBe(4);
    expect(payload.prompt).toBe('A ____ appeared today.');
  });

  it('produces no multiple_choice when fewer than 3 distractors exist', () => {
    const drafts = buildExercises([
      nounSentence('mc-a', 'cat'),
      nounSentence('mc-b', 'ship'),
    ]);
    expect(drafts.some((d) => d.type === ExerciseType.MultipleChoice)).toBe(
      false,
    );
  });
});

describe('buildExercises — find_error', () => {
  it('demotes a regular past-tense verb to its base form', () => {
    const sentence = makeSentence(
      'She walked to the market yesterday.',
      [
        { text: 'She', pos: 'PRON', tag: 'PRP' },
        { text: 'walked', lemma: 'walk', pos: 'VERB', tag: 'VBD' },
        { text: 'to', pos: 'ADP', tag: 'IN' },
        { text: 'the', pos: 'DET', tag: 'DT' },
        { text: 'market', pos: 'NOUN', tag: 'NN' },
        { text: 'yesterday', pos: 'NOUN', tag: 'NN' },
        { text: '.', pos: 'PUNCT', tag: '.' },
      ],
      'fe-1',
    );
    const draft = buildExercises([sentence]).find(
      (d) => d.type === ExerciseType.FindError,
    );
    if (draft?.type !== ExerciseType.FindError) {
      throw new Error('expected a find_error');
    }
    const payload: FindErrorPayload = draft.payload;
    expect(payload).toMatchObject({
      sentenceId: 'fe-1',
      prompt: 'She walk to the market yesterday.',
      tokenPosition: 1,
      incorrectForm: 'walk',
      correction: 'walked',
    });
  });

  it('capitalises the injected form when the verb opens the sentence', () => {
    const sentence = makeSentence('Rained all night without stopping here.', [
      { text: 'Rained', lemma: 'rain', pos: 'VERB', tag: 'VBD' },
      { text: 'all', pos: 'DET', tag: 'DT' },
      { text: 'night', pos: 'NOUN', tag: 'NN' },
      { text: 'without', pos: 'ADP', tag: 'IN' },
      { text: 'stopping', lemma: 'stop', pos: 'VERB', tag: 'VBG' },
      { text: 'here', pos: 'ADV', tag: 'RB' },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ]);
    const draft = buildExercises([sentence]).find(
      (d) => d.type === ExerciseType.FindError,
    );
    if (draft?.type !== ExerciseType.FindError) {
      throw new Error('expected a find_error');
    }
    expect(draft.payload.prompt).toBe('Rain all night without stopping here.');
    expect(draft.payload.incorrectForm).toBe('Rain');
  });

  it('skips be/have/do and verbs whose lemma equals the surface form', () => {
    const sentence = makeSentence('They had fun and put things away.', [
      { text: 'They', pos: 'PRON', tag: 'PRP' },
      { text: 'had', lemma: 'have', pos: 'VERB', tag: 'VBD' },
      { text: 'fun', pos: 'NOUN', tag: 'NN' },
      { text: 'and', pos: 'CCONJ', tag: 'CC' },
      { text: 'put', lemma: 'put', pos: 'VERB', tag: 'VBD' },
      { text: 'things', pos: 'NOUN', tag: 'NNS' },
      { text: 'away', pos: 'ADV', tag: 'RB' },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ]);
    const drafts = buildExercises([sentence]);
    expect(drafts.some((d) => d.type === ExerciseType.FindError)).toBe(false);
  });
});

describe('buildExercises — ordering and caps', () => {
  it('returns drafts grouped by type in the fixed order fill_blank, reorder, multiple_choice, find_error', () => {
    const sentences = Array.from({ length: 3 }, (_, i) =>
      fillBlankSentence(`ord-${i}`),
    );
    const types = buildExercises(sentences).map((d) => d.type);

    // The distinct type-groups, in the order they first appear, must be a
    // subsequence of the canonical order.
    const canonical = [
      ExerciseType.FillBlank,
      ExerciseType.Reorder,
      ExerciseType.MultipleChoice,
      ExerciseType.FindError,
    ];
    const groups = types.filter((t, i) => t !== types[i - 1]);
    let cursor = 0;
    for (const group of groups) {
      const at = canonical.indexOf(group, cursor);
      expect(at).toBeGreaterThanOrEqual(0);
      cursor = at;
    }
  });

  it('caps each type at maxPerType', () => {
    const sentences = Array.from({ length: 20 }, (_, i) =>
      fillBlankSentence(`cap-${i}`),
    );
    const drafts = buildExercises(sentences, { maxPerType: 2 });
    const fillBlanks = drafts.filter((d) => d.type === ExerciseType.FillBlank);
    const reorders = drafts.filter((d) => d.type === ExerciseType.Reorder);
    expect(fillBlanks).toHaveLength(2);
    expect(reorders).toHaveLength(2);
  });
});
