import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CefrLevel } from '../enums/cefr-level.enum.js';
import {
  buildCheatSheet,
  classifyEgpRecord,
  type EgpRecord,
  grammarConstructionSlug,
  parseEgpRecords,
} from './egp.js';

const rec = (over: Partial<EgpRecord> = {}): EgpRecord => ({
  index: 1,
  category: 'PRESENT',
  subcategory: 'simple',
  level: CefrLevel.A1,
  guideword: 'USE: HABITS AND GENERAL FACTS',
  can_do: 'Can talk about habits.',
  example: 'I go to work by bus.',
  ...over,
});

describe('classifyEgpRecord', () => {
  it.each([
    ['USE: HABITS', 'use'],
    ['FORM/USE: SOMETHING', 'use'],
    ["FORM: AFFIRMATIVE WITH 'DO'", 'form'],
    ['General comment', 'form'],
  ])('classifies %j as %s', (guideword, expected) => {
    expect(classifyEgpRecord(rec({ guideword }))).toBe(expected);
  });
});

describe('grammarConstructionSlug', () => {
  it('carries the category so a shared subcategory name does not collide', () => {
    expect(grammarConstructionSlug('ADJECTIVES', 'comparatives')).toBe(
      'adjectives-comparatives',
    );
    expect(grammarConstructionSlug('CLAUSES', 'comparatives')).toBe(
      'clauses-comparatives',
    );
  });

  it('collapses punctuation and whitespace runs', () => {
    expect(grammarConstructionSlug('PASSIVES', 'passives: form')).toBe(
      'passives-passives-form',
    );
  });
});

describe('buildCheatSheet', () => {
  it('lists only FORM records, stripping the guideword prefix', () => {
    const md = buildCheatSheet([
      rec({ guideword: 'USE: X', can_do: 'use text' }),
      rec({
        guideword: "FORM: NEGATIVE WITH 'NOT'",
        level: CefrLevel.A2,
        can_do: 'neg',
      }),
    ]);

    expect(md).toBe("## Form\n\n- **NEGATIVE WITH 'NOT'** — A2 — neg");
  });

  it('returns null when there are no FORM records', () => {
    expect(buildCheatSheet([rec({ guideword: 'USE: X' })])).toBeNull();
  });

  it('omits the dash when a FORM record has no can-do statement', () => {
    const md = buildCheatSheet([
      rec({ guideword: 'FORM: BARE', level: CefrLevel.B1, can_do: '' }),
    ]);

    expect(md).toBe('## Form\n\n- **BARE** — B1');
  });
});

describe('parseEgpRecords', () => {
  it('rejects an unknown level', () => {
    expect(() => parseEgpRecords([rec({ level: 'Z9' as never })])).toThrow();
  });

  it('accepts the bundled assets/egp.json', async () => {
    const raw = await readFile(
      join(process.cwd(), 'assets', 'egp.json'),
      'utf-8',
    );

    const parsed = parseEgpRecords(JSON.parse(raw));

    expect(parsed.length).toBe(1239);
    expect(parsed.filter((r) => classifyEgpRecord(r) === 'use')).toHaveLength(
      574,
    );
  });
});
