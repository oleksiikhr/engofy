import { expect, test } from '@playwright/test';
import { extractLexBlocks } from '../src/lib/lex-blocks';

// extractLexBlocks is pure, so the target ranges are checked without a browser.

test.describe('extractLexBlocks targets', () => {
  test('ranges cover the text inside <mark>, in block coordinates', () => {
    const html =
      '<figure><blockquote>There are <mark data-role="content">some</mark> <mark data-role="grammar">shops</mark> here.</blockquote></figure>';

    expect(extractLexBlocks(html)).toEqual([
      {
        text: 'There are some shops here.',
        targets: [
          { start: 10, end: 14 },
          { start: 15, end: 20 },
        ],
      },
    ]);
  });

  test('a mark with a space inside stays one range', () => {
    const html = '<p>Many <mark>many a</mark> time.</p>';

    expect(extractLexBlocks(html)[0]?.targets).toEqual([{ start: 5, end: 11 }]);
  });

  test('a block without marks has no targets', () => {
    expect(extractLexBlocks('<p>No marks here.</p>')).toEqual([
      { text: 'No marks here.', targets: [] },
    ]);
  });
});
