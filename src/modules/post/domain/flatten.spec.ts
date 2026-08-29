import { flattenDoc, flattenParagraph } from './flatten.js';
import type { Doc, Paragraph } from './node-tree.types.js';

describe('flattenParagraph', () => {
  it('concatenates text and span node text with per-child offsets', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'The cat ' },
        {
          type: 'span',
          text: 'sat',
          kind: 'word',
          wordDefinitionId: 'wd-1',
          pos: 'verb',
        },
        { type: 'text', text: ' on the mat.' },
      ],
    };

    const { text, offsets } = flattenParagraph(paragraph);

    expect(text).toBe('The cat sat on the mat.');
    expect(offsets).toEqual([
      { index: 0, start: 0, end: 8 },
      { index: 1, start: 8, end: 11 },
      { index: 2, start: 11, end: 23 },
    ]);
  });

  it('returns an empty string and no offsets for an empty paragraph', () => {
    const { text, offsets } = flattenParagraph({
      type: 'paragraph',
      children: [],
    });

    expect(text).toBe('');
    expect(offsets).toEqual([]);
  });
});

describe('flattenDoc', () => {
  it('flattens each ListBlock item as its own unit, with itemIndex set and blockIndex pointing at the list', () => {
    const doc: Doc = {
      type: 'doc',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Before.' }] },
        {
          type: 'list',
          ordered: false,
          items: [
            { children: [{ type: 'text', text: 'First item.' }] },
            { children: [{ type: 'text', text: 'Second item.' }] },
          ],
        },
        { type: 'paragraph', children: [{ type: 'text', text: 'After.' }] },
      ],
    };

    const { text, units } = flattenDoc(doc);

    expect(text).toBe('Before.\n\nFirst item.\n\nSecond item.\n\nAfter.');
    expect(
      units.map((unit) => ({
        blockIndex: unit.blockIndex,
        itemIndex: unit.itemIndex,
      })),
    ).toEqual([
      { blockIndex: 0, itemIndex: undefined },
      { blockIndex: 1, itemIndex: 0 },
      { blockIndex: 1, itemIndex: 1 },
      { blockIndex: 2, itemIndex: undefined },
    ]);
  });

  it('joins paragraphs with a blank line and offsets each paragraph within the joined text', () => {
    const doc: Doc = {
      type: 'doc',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'First paragraph.' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Second one.' }],
        },
      ],
    };

    const { text, units } = flattenDoc(doc);

    expect(text).toBe('First paragraph.\n\nSecond one.');
    expect(units).toEqual([
      {
        blockIndex: 0,
        start: 0,
        end: 16,
        nodes: [{ index: 0, start: 0, end: 16 }],
      },
      {
        blockIndex: 1,
        start: 18,
        end: 29,
        nodes: [{ index: 0, start: 0, end: 11 }],
      },
    ]);
  });
});
