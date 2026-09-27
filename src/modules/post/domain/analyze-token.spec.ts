import { CefrLevel } from '../enums/cefr-level.enum.js';
import {
  type AnalyzableSentenceToken,
  detectVerbGroups,
  tokenIrregularForms,
  tokenTense,
} from './analyze-token.js';
import { indexIrregularVerbsByLemma } from './irregular-verb.js';

const irregular = indexIrregularVerbsByLemma([
  {
    base_form: 'go',
    past_simple: ['went'],
    past_participle: ['gone'],
    cefr_level: CefrLevel.A1,
  },
]);

const token = (overrides: Record<string, unknown>) => ({
  text: 'went',
  lemma: 'go',
  pos: 'VERB',
  tag: 'VBD',
  morph: { Tense: 'Past', VerbForm: 'Fin' },
  ...overrides,
});

describe('tokenTense', () => {
  it('reads past and present from a finite verb', () => {
    expect(tokenTense(token({}))).toBe('past');
    expect(
      tokenTense(token({ morph: { Tense: 'Pres', VerbForm: 'Fin' } })),
    ).toBe('present');
  });

  it('marks the modal will as future', () => {
    expect(
      tokenTense(
        token({
          text: 'will',
          lemma: 'will',
          pos: 'AUX',
          tag: 'MD',
          morph: {},
        }),
      ),
    ).toBe('future');
  });

  it('leaves non-finite verbs and non-verbs untagged', () => {
    expect(
      tokenTense(token({ morph: { Tense: 'Past', VerbForm: 'Part' } })),
    ).toBeNull();
    expect(tokenTense(token({ pos: 'NOUN' }))).toBeNull();
  });
});

describe('tokenIrregularForms', () => {
  it('flags an irregular past form', () => {
    expect(tokenIrregularForms(token({}), irregular)).toEqual({
      base: 'go',
      pastSimple: ['went'],
      pastParticiple: ['gone'],
    });
  });

  it('does not flag the base form, a regular verb or a non-verb', () => {
    expect(tokenIrregularForms(token({ text: 'go' }), irregular)).toBeNull();
    expect(
      tokenIrregularForms(token({ text: 'walked', lemma: 'walk' }), irregular),
    ).toBeNull();
    expect(tokenIrregularForms(token({ pos: 'NOUN' }), irregular)).toBeNull();
  });
});

// Builds a flat verb-group fixture: `head` is a spec's own index for a root,
// or the index of its syntactic head otherwise — mirrors build-sentences
// .spec.ts's `tokens()` head convention, minus char offsets (irrelevant
// here).
function group(
  specs: Array<
    Partial<AnalyzableSentenceToken> & { text: string; head: number }
  >,
): AnalyzableSentenceToken[] {
  return specs.map((spec, index) => ({
    position: index,
    text: spec.text,
    lemma: spec.lemma ?? spec.text.toLowerCase(),
    pos: spec.pos ?? 'VERB',
    tag: spec.tag ?? 'VB',
    dep: spec.dep ?? 'ROOT',
    headPosition: spec.head === index ? null : spec.head,
    morph: spec.morph ?? {},
  }));
}

describe('detectVerbGroups', () => {
  it.each([
    [
      'present simple',
      group([
        {
          text: 'draws',
          tag: 'VBZ',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          head: 0,
        },
      ]),
      'present',
      'simple',
    ],
    [
      'past simple',
      group([
        {
          text: 'drew',
          tag: 'VBD',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          head: 0,
        },
      ]),
      'past',
      'simple',
    ],
    [
      'future simple',
      group([
        {
          text: 'will',
          lemma: 'will',
          pos: 'AUX',
          tag: 'MD',
          dep: 'aux',
          morph: { VerbForm: 'Fin' },
          head: 1,
        },
        { text: 'draw', tag: 'VB', morph: { VerbForm: 'Inf' }, head: 1 },
      ]),
      'future',
      'simple',
    ],
    [
      'present continuous',
      group([
        {
          text: 'is',
          lemma: 'be',
          pos: 'AUX',
          tag: 'VBZ',
          dep: 'aux',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          head: 1,
        },
        { text: 'drawing', tag: 'VBG', morph: {}, head: 1 },
      ]),
      'present',
      'continuous',
    ],
    [
      'past continuous',
      group([
        {
          text: 'was',
          lemma: 'be',
          pos: 'AUX',
          tag: 'VBD',
          dep: 'aux',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          head: 1,
        },
        { text: 'drawing', tag: 'VBG', morph: {}, head: 1 },
      ]),
      'past',
      'continuous',
    ],
    [
      'future continuous',
      group([
        {
          text: 'will',
          lemma: 'will',
          pos: 'AUX',
          tag: 'MD',
          dep: 'aux',
          morph: { VerbForm: 'Fin' },
          head: 2,
        },
        {
          text: 'be',
          lemma: 'be',
          pos: 'AUX',
          tag: 'VB',
          dep: 'aux',
          morph: { VerbForm: 'Inf' },
          head: 2,
        },
        { text: 'drawing', tag: 'VBG', morph: {}, head: 2 },
      ]),
      'future',
      'continuous',
    ],
    [
      'present perfect',
      group([
        {
          text: 'has',
          lemma: 'have',
          pos: 'AUX',
          tag: 'VBZ',
          dep: 'aux',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          head: 1,
        },
        { text: 'drawn', tag: 'VBN', morph: {}, head: 1 },
      ]),
      'present',
      'perfect',
    ],
    [
      'past perfect',
      group([
        {
          text: 'had',
          lemma: 'have',
          pos: 'AUX',
          tag: 'VBD',
          dep: 'aux',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          head: 1,
        },
        { text: 'drawn', tag: 'VBN', morph: {}, head: 1 },
      ]),
      'past',
      'perfect',
    ],
    [
      'future perfect',
      group([
        {
          text: 'will',
          lemma: 'will',
          pos: 'AUX',
          tag: 'MD',
          dep: 'aux',
          morph: { VerbForm: 'Fin' },
          head: 2,
        },
        {
          text: 'have',
          lemma: 'have',
          pos: 'AUX',
          tag: 'VB',
          dep: 'aux',
          morph: { VerbForm: 'Inf' },
          head: 2,
        },
        { text: 'drawn', tag: 'VBN', morph: {}, head: 2 },
      ]),
      'future',
      'perfect',
    ],
    [
      'present perfect continuous',
      group([
        {
          text: 'has',
          lemma: 'have',
          pos: 'AUX',
          tag: 'VBZ',
          dep: 'aux',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          head: 2,
        },
        {
          text: 'been',
          lemma: 'be',
          pos: 'AUX',
          tag: 'VBN',
          dep: 'aux',
          morph: {},
          head: 2,
        },
        { text: 'drawing', tag: 'VBG', morph: {}, head: 2 },
      ]),
      'present',
      'perfectContinuous',
    ],
    [
      'past perfect continuous',
      group([
        {
          text: 'had',
          lemma: 'have',
          pos: 'AUX',
          tag: 'VBD',
          dep: 'aux',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          head: 2,
        },
        {
          text: 'been',
          lemma: 'be',
          pos: 'AUX',
          tag: 'VBN',
          dep: 'aux',
          morph: {},
          head: 2,
        },
        { text: 'drawing', tag: 'VBG', morph: {}, head: 2 },
      ]),
      'past',
      'perfectContinuous',
    ],
    [
      'future perfect continuous',
      group([
        {
          text: 'will',
          lemma: 'will',
          pos: 'AUX',
          tag: 'MD',
          dep: 'aux',
          morph: { VerbForm: 'Fin' },
          head: 3,
        },
        {
          text: 'have',
          lemma: 'have',
          pos: 'AUX',
          tag: 'VB',
          dep: 'aux',
          morph: { VerbForm: 'Inf' },
          head: 3,
        },
        {
          text: 'been',
          lemma: 'be',
          pos: 'AUX',
          tag: 'VBN',
          dep: 'aux',
          morph: {},
          head: 3,
        },
        { text: 'drawing', tag: 'VBG', morph: {}, head: 3 },
      ]),
      'future',
      'perfectContinuous',
    ],
  ] as const)(
    'assigns %s to every member of the verb group',
    (_label, tokens, tense, aspect) => {
      const groups = detectVerbGroups(tokens);
      const headPosition = tokens.length - 1;
      const head = groups.get(headPosition);
      expect(head).toEqual({
        verbGroupId: `vg-${headPosition}`,
        tense,
        aspect,
        isGoingToFuture: false,
      });
      for (const t of tokens) {
        expect(groups.get(t.position)).toBe(head);
      }
    },
  );

  it('assigns going-to-future to the whole "be going to VERB" span', () => {
    const tokens = group([
      {
        text: 'is',
        lemma: 'be',
        pos: 'AUX',
        tag: 'VBZ',
        dep: 'aux',
        morph: { Tense: 'Pres', VerbForm: 'Fin' },
        head: 1,
      },
      { text: 'going', lemma: 'go', tag: 'VBG', head: 1 },
      { text: 'to', pos: 'PART', tag: 'TO', dep: 'aux', head: 3 },
      {
        text: 'draw',
        tag: 'VB',
        dep: 'xcomp',
        morph: { VerbForm: 'Inf' },
        head: 1,
      },
    ]);
    const groups = detectVerbGroups(tokens);
    const going = groups.get(1);
    expect(going).toEqual({
      verbGroupId: 'vg-1',
      tense: 'future',
      aspect: 'simple',
      isGoingToFuture: true,
    });
    for (const position of [0, 1, 2, 3]) {
      expect(groups.get(position)).toBe(going);
    }
  });

  it('does not mistake literal movement ("is going to the store") for going-to-future', () => {
    const tokens = group([
      {
        text: 'is',
        lemma: 'be',
        pos: 'AUX',
        tag: 'VBZ',
        dep: 'aux',
        morph: { Tense: 'Pres', VerbForm: 'Fin' },
        head: 1,
      },
      { text: 'going', lemma: 'go', tag: 'VBG', head: 1 },
      { text: 'store', pos: 'NOUN', tag: 'NN', dep: 'prep', head: 1 },
    ]);
    const groups = detectVerbGroups(tokens);
    expect(groups.get(1)).toEqual({
      verbGroupId: 'vg-1',
      tense: 'present',
      aspect: 'continuous',
      isGoingToFuture: false,
    });
    expect(groups.get(2)).toBeUndefined();
  });

  it('skips a clause with no finite member', () => {
    const tokens = group([
      { text: 'to', pos: 'PART', tag: 'TO', dep: 'aux', head: 1 },
      {
        text: 'draw',
        tag: 'VB',
        dep: 'xcomp',
        morph: { VerbForm: 'Inf' },
        head: 1,
      },
    ]);
    expect(detectVerbGroups(tokens).size).toBe(0);
  });
});
