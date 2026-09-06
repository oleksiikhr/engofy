import { collectSpanNodes } from './collect-spans.js';
import type { Block } from './node-tree.types.js';

describe('collectSpanNodes', () => {
  it('returns span leaves from paragraphs in document order', () => {
    const blocks: Block[] = [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'A ' },
          {
            type: 'span',
            kind: 'word',
            text: 'cat',
            wordDefinitionId: 'w1',
            pos: 'noun',
          },
          { type: 'text', text: ' and a ' },
          {
            type: 'span',
            kind: 'phrase',
            text: 'hot dog',
            phraseId: 'p1',
          },
        ],
      },
    ];

    expect(collectSpanNodes(blocks).map((s) => s.text)).toEqual([
      'cat',
      'hot dog',
    ]);
  });

  it('descends into every list item', () => {
    const blocks: Block[] = [
      {
        type: 'list',
        ordered: false,
        items: [
          {
            children: [
              {
                type: 'span',
                kind: 'grammar_only',
                text: 'first',
              },
            ],
          },
          {
            children: [
              { type: 'text', text: 'plain' },
              {
                type: 'span',
                kind: 'grammar_only',
                text: 'second',
              },
            ],
          },
        ],
      },
    ];

    expect(collectSpanNodes(blocks).map((s) => s.text)).toEqual([
      'first',
      'second',
    ]);
  });

  it('is empty when no block holds a span', () => {
    const blocks: Block[] = [
      { type: 'paragraph', children: [{ type: 'text', text: 'nothing here' }] },
    ];

    expect(collectSpanNodes(blocks)).toEqual([]);
  });
});
