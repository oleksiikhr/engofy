import { PhraseType } from '../enums/phrase-type.enum.js';
import { IDIOM_SYSTEM_PROMPT } from './annotation-prompt.js';

const PHRASAL_VERBS_UNTAGGED = /Phrasal verbs.*Leave them completely untagged/s;

describe('IDIOM_SYSTEM_PROMPT', () => {
  it('lists only the idiom/collocation phrase types as allowed', () => {
    expect(IDIOM_SYSTEM_PROMPT).toContain(
      `Allowed phrase types: ${PhraseType.Idiom}, ${PhraseType.Collocation}`,
    );
    expect(IDIOM_SYSTEM_PROMPT).not.toContain(PhraseType.PhrasalVerb);
  });

  it('documents the rare-delimiter tag format', () => {
    expect(IDIOM_SYSTEM_PROMPT).toContain(
      '⟦heavy rain⟧{{p|collocation|heavy rain|g1}}',
    );
    expect(IDIOM_SYSTEM_PROMPT).toContain(
      'Fields are separated by "|", never ":"',
    );
  });

  it('tells the model to copy the input back verbatim and never tag single words', () => {
    expect(IDIOM_SYSTEM_PROMPT).toContain('COPY IT BACK OUT IN FULL');
    expect(IDIOM_SYSTEM_PROMPT).toContain('Never emit a one-word tag');
  });

  it('tells the model to leave phrasal verbs untagged', () => {
    expect(IDIOM_SYSTEM_PROMPT).toMatch(PHRASAL_VERBS_UNTAGGED);
  });
});
