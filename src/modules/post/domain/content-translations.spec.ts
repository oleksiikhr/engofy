import {
  readGrammarTranslations,
  readLexiconTranslations,
} from './content-translations.js';

describe('readLexiconTranslations', () => {
  it('returns a valid per-language map as is', () => {
    expect(readLexiconTranslations({ uk: { translation: 'ринок' } })).toEqual({
      uk: { translation: 'ринок' },
    });
  });

  it('reads null and undefined as no translations', () => {
    expect(readLexiconTranslations(null)).toEqual({});
    expect(readLexiconTranslations(undefined)).toEqual({});
  });

  it('reads a malformed or unknown-language value as no translations', () => {
    expect(readLexiconTranslations({ uk: { translation: '' } })).toEqual({});
    expect(readLexiconTranslations({ uk: 'ринок' })).toEqual({});
    expect(readLexiconTranslations({ xx: { translation: 'a' } })).toEqual({});
  });
});

describe('readGrammarTranslations', () => {
  it('returns a valid per-language map as is', () => {
    expect(
      readGrammarTranslations({ uk: { explanation: 'Пояснення.' } }),
    ).toEqual({ uk: { explanation: 'Пояснення.' } });
  });

  it('reads a lexicon-shaped value as no translations', () => {
    expect(readGrammarTranslations({ uk: { translation: 'ринок' } })).toEqual(
      {},
    );
  });
});
