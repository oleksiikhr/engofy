import { ContentLanguage } from '../enums/content-language.enum.js';
import {
  pickGrammarTranslation,
  pickLexiconTranslation,
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

  it('keeps translated examples', () => {
    const value = {
      uk: { explanation: 'Пояснення.', examples: ['Я гуляю.', 'Вона читає.'] },
    };
    expect(readGrammarTranslations(value)).toEqual(value);
  });

  it('reads a lexicon-shaped value as no translations', () => {
    expect(readGrammarTranslations({ uk: { translation: 'ринок' } })).toEqual(
      {},
    );
  });
});

describe('pickLexiconTranslation', () => {
  it('picks the requested language, null when it is missing or malformed', () => {
    const raw = { uk: { translation: 'ринок' } };
    expect(pickLexiconTranslation(raw, ContentLanguage.Uk)).toBe('ринок');
    expect(pickLexiconTranslation(raw, 'xx' as ContentLanguage)).toBeNull();
    expect(pickLexiconTranslation(null, ContentLanguage.Uk)).toBeNull();
  });
});

describe('pickGrammarTranslation', () => {
  it('picks the explanation and example translations of one language', () => {
    const raw = { uk: { explanation: 'Пояснення.', examples: ['Приклад.'] } };
    expect(pickGrammarTranslation(raw, ContentLanguage.Uk)).toEqual({
      translation: 'Пояснення.',
      exampleTranslations: ['Приклад.'],
    });
  });

  it('is empty for a language with no entry', () => {
    expect(pickGrammarTranslation({}, ContentLanguage.Uk)).toEqual({
      translation: null,
      exampleTranslations: null,
    });
  });
});
