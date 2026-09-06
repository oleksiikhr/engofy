import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseIrregularVerbs } from './irregular-verb.js';

const validEntry = {
  base_form: 'go',
  past_simple: ['went'],
  past_participle: ['gone'],
  cefr_level: 'A1',
};

describe('parseIrregularVerbs', () => {
  it('parses a well-formed list', () => {
    const parsed = parseIrregularVerbs([
      validEntry,
      {
        base_form: 'be',
        past_simple: ['was', 'were'],
        past_participle: ['been'],
        cefr_level: 'A1',
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[1].past_simple).toEqual(['was', 'were']);
  });

  it('rejects a duplicate base form (case-insensitive)', () => {
    expect(() =>
      parseIrregularVerbs([validEntry, { ...validEntry, base_form: 'GO' }]),
    ).toThrow('duplicate base_form');
  });

  it('rejects an unknown cefr level', () => {
    expect(() =>
      parseIrregularVerbs([{ ...validEntry, cefr_level: 'D1' }]),
    ).toThrow();
  });

  it('rejects an entry with no past forms', () => {
    expect(() =>
      parseIrregularVerbs([{ ...validEntry, past_simple: [] }]),
    ).toThrow();
  });

  it('accepts the bundled assets/irregular-verbs.json', async () => {
    const raw = await readFile(
      join(process.cwd(), 'assets', 'irregular-verbs.json'),
      'utf-8',
    );

    const parsed = parseIrregularVerbs(JSON.parse(raw));

    expect(parsed.length).toBeGreaterThan(100);
  });
});
