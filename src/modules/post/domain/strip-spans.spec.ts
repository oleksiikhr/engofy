import type { Block } from './node-tree.types.js';
import { stripSpans } from './strip-spans.js';

describe('stripSpans', () => {
  it('turns every span kind into text and merges adjacent text, keeping marks and paragraph flags', () => {
    const block: Block = {
      type: 'paragraph',
      level: 2,
      children: [
        { type: 'text', text: 'She ' },
        {
          type: 'span',
          kind: 'word',
          text: 'had',
          wordDefinitionId: 'w1',
          pos: 'AUX',
          grammarConstruct: 'past-perfect',
        },
        { type: 'text', text: ' ' },
        { type: 'span', kind: 'grammar_only', text: 'drawn' },
        { type: 'text', text: ' ' },
        {
          type: 'span',
          kind: 'phrase',
          text: 'every coastline',
          phraseId: 'p1',
          marks: ['bold'],
        },
        { type: 'link', text: ' here', href: 'https://example.com' },
      ],
    };

    expect(stripSpans(block)).toEqual({
      type: 'paragraph',
      level: 2,
      children: [
        { type: 'text', text: 'She had drawn ' },
        { type: 'text', text: 'every coastline', marks: ['bold'] },
        { type: 'link', text: ' here', href: 'https://example.com' },
      ],
    });
  });

  it('strips spans inside every list item', () => {
    const block: Block = {
      type: 'list',
      ordered: true,
      items: [
        {
          children: [
            { type: 'text', text: 'Take ' },
            {
              type: 'span',
              kind: 'word',
              text: 'care',
              wordDefinitionId: 'w2',
              pos: 'NOUN',
            },
          ],
        },
      ],
    };

    expect(stripSpans(block)).toEqual({
      type: 'list',
      ordered: true,
      items: [{ children: [{ type: 'text', text: 'Take care' }] }],
    });
  });

  it('leaves a block with no spans unchanged', () => {
    const block: Block = {
      type: 'paragraph',
      quote: true,
      children: [{ type: 'text', text: 'Plain.' }],
    };
    expect(stripSpans(block)).toEqual(block);
  });
});
