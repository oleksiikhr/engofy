import { CefrLevel } from '../enums/cefr-level.enum.js';
import { tokenIrregularForms, tokenTense } from './analyze-token.js';
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
