import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  parseLexiconContentSeedFile,
  parsePhraseContentSeedFile,
} from './lexicon-content-seed.js';

const asset = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(join(process.cwd(), 'assets', name), 'utf-8'));

describe('shipped dictionary assets', () => {
  it('assets/lexicon-content.json satisfies the seed schema', async () => {
    const seed = parseLexiconContentSeedFile(
      await asset('lexicon-content.json'),
    );

    expect(Object.keys(seed).length).toBeGreaterThan(0);
  });

  it('assets/phrase-content.json satisfies the seed schema', async () => {
    const seed = parsePhraseContentSeedFile(await asset('phrase-content.json'));

    expect(Object.keys(seed).length).toBeGreaterThan(0);
  });
});
