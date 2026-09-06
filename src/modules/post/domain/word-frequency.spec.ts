import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseWordFrequencyList } from './word-frequency.js';

describe('parseWordFrequencyList', () => {
  it('maps each word to its 1-based rank', () => {
    const ranks = parseWordFrequencyList('the\nto\nand\n');

    expect(ranks.get('the')).toBe(1);
    expect(ranks.get('to')).toBe(2);
    expect(ranks.get('and')).toBe(3);
  });

  it('ignores blank lines and casing, and keeps the first rank for a repeat', () => {
    const ranks = parseWordFrequencyList('The\n\n  \nTO\nthe\n');

    expect(ranks.get('the')).toBe(1);
    expect(ranks.get('to')).toBe(2);
    expect(ranks.size).toBe(2);
  });

  it('ranks the bundled assets/word-frequency.txt', async () => {
    const text = await readFile(
      join(process.cwd(), 'assets', 'word-frequency.txt'),
      'utf-8',
    );

    const ranks = parseWordFrequencyList(text);

    expect(ranks.size).toBe(50000);
    expect(ranks.get('the')).toBe(1);
  });
});
