import { expect, test } from '@playwright/test';
import {
  constructionLabel,
  guidewordLabel,
  phraseTypeLabel,
  posLabel,
  shortExample,
} from '../src/lib/popup-labels';

// The popup label helpers are pure, so they are checked without a browser.

test.describe('popup labels', () => {
  test('part of speech and phrase type read as plain words', () => {
    expect(posLabel('proper_noun')).toBe('proper noun');
    expect(posLabel('verb')).toBe('verb');
    expect(posLabel('other')).toBeNull();
    expect(phraseTypeLabel('phrasal_verb')).toBe('phrasal verb');
    expect(phraseTypeLabel(null)).toBeNull();
  });

  test('guideword drops the prefix, the caps and the pipe', () => {
    expect(guidewordLabel('USE: EARLIER PAST')).toBe('Earlier past');
    expect(guidewordLabel('FORM/USE: UNREAL PAST | PAST REGRET')).toBe(
      'Unreal past, past regret',
    );
    expect(guidewordLabel("USE: I'D RATHER")).toBe("I'd rather");
  });

  test('construction name is capitalised without a pipe', () => {
    expect(constructionLabel('third conditional')).toBe('Third conditional');
    expect(constructionLabel('modals | ability')).toBe('Modals, ability');
  });

  test('example is cut to one or two short sentences', () => {
    expect(shortExample('She left. He stayed. They talked.')).toBe(
      'She left. He stayed.',
    );
    expect(shortExample('One line only.')).toBe('One line only.');
    expect(shortExample('It costs 3.50 today. Really.')).toBe(
      'It costs 3.50 today. Really.',
    );
    expect(shortExample('First one.\nSecond one.\nThird one.')).toBe(
      'First one. Second one.',
    );
    const long = `${'word '.repeat(40).trim()}. Another sentence here.`;
    expect(shortExample(long)).toBe(`${'word '.repeat(40).trim()}.`);
  });
});
