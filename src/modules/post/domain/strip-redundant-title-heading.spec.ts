import type { Doc } from './node-tree.types.js';
import { stripRedundantTitleHeading } from './strip-redundant-title-heading.js';

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

describe('stripRedundantTitleHeading', () => {
  it('drops a leading H1 that repeats the title', () => {
    const out = stripRedundantTitleHeading(
      doc(heading('How to Pack a Bag'), para('Body.')),
      'How to Pack a Bag',
    );
    expect(out.children).toEqual([para('Body.')]);
  });

  it('matches case- and whitespace-insensitively', () => {
    const out = stripRedundantTitleHeading(
      doc(heading('how to   pack a bag'), para('Body.')),
      'How to Pack a Bag',
    );
    expect(out.children).toHaveLength(1);
  });

  it('keeps the heading when it differs from the title', () => {
    const input = doc(heading('A Different Heading'), para('Body.'));
    expect(
      stripRedundantTitleHeading(input, 'The Title').children,
    ).toHaveLength(2);
  });

  it('keeps the heading when the post has no title', () => {
    const input = doc(heading('Only Heading'), para('Body.'));
    expect(stripRedundantTitleHeading(input, null).children).toHaveLength(2);
  });

  it('leaves a non-heading first block alone', () => {
    const input = doc(para('The Title'), para('Body.'));
    expect(
      stripRedundantTitleHeading(input, 'The Title').children,
    ).toHaveLength(2);
  });

  it('ignores a deeper heading level', () => {
    const input = doc(heading('The Title', 2), para('Body.'));
    expect(
      stripRedundantTitleHeading(input, 'The Title').children,
    ).toHaveLength(2);
  });
});
