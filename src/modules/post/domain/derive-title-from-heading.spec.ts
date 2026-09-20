import { deriveTitleFromHeading } from './derive-title-from-heading.js';
import type { Doc } from './node-tree.types.js';

const heading = (text: string, level: 1 | 2 = 1): Doc['children'][number] => ({
  type: 'paragraph',
  level,
  children: [{ type: 'text', text }],
});

const para = (text: string): Doc['children'][number] => ({
  type: 'paragraph',
  children: [{ type: 'text', text }],
});

const doc = (...children: Doc['children']): Doc => ({ type: 'doc', children });

describe('deriveTitleFromHeading', () => {
  it('returns the text of a leading H1', () => {
    expect(
      deriveTitleFromHeading(doc(heading('A Saturday Market'), para('Body.'))),
    ).toBe('A Saturday Market');
  });

  it('collapses inner whitespace', () => {
    expect(
      deriveTitleFromHeading(doc(heading('  A   Saturday\nMarket '))),
    ).toBe('A Saturday Market');
  });

  it('returns null when the doc does not open with an H1', () => {
    expect(deriveTitleFromHeading(doc(para('Body.'), heading('Late')))).toBe(
      null,
    );
    expect(deriveTitleFromHeading(doc(heading('Sub', 2), para('Body.')))).toBe(
      null,
    );
  });

  it('returns null for an empty heading or an empty doc', () => {
    expect(deriveTitleFromHeading(doc(heading('   ')))).toBe(null);
    expect(deriveTitleFromHeading(doc())).toBe(null);
  });
});
