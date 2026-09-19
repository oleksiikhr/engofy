import { locateGrammarMatch } from './locate-grammar-match.js';
import type { Block } from './node-tree.types.js';

const PARAGRAPH: Block = {
  type: 'paragraph',
  children: [
    { type: 'text', text: 'She ' },
    { type: 'span', kind: 'grammar_only', text: 'had left' },
    { type: 'text', text: ' early. Then he had come.' },
  ],
};

// "Then he had come." — tokens sentence-relative.
const SECOND_SENTENCE_TOKENS = [
  { position: 0, charStart: 0, charEnd: 4 },
  { position: 1, charStart: 5, charEnd: 7 },
  { position: 2, charStart: 8, charEnd: 11 },
  { position: 3, charStart: 12, charEnd: 16 },
  { position: 4, charStart: 16, charEnd: 17 },
];

describe('locateGrammarMatch', () => {
  it('shifts token char offsets by the sentence offset in the unit', () => {
    // "She had left early. Then he had come." — sentence 2 starts at 20.
    expect(
      locateGrammarMatch({
        block: PARAGRAPH,
        sentence: {
          unitIndex: 0,
          charStart: 20,
          charEnd: 37,
          rawText: 'Then he had come.',
        },
        tokens: SECOND_SENTENCE_TOKENS,
        match: { tokenStart: 2, tokenEnd: 4 },
      }),
    ).toEqual({ itemIndex: null, charStart: 28, charEnd: 36 });
  });

  it('spans from the first covered token start to the last covered token end', () => {
    expect(
      locateGrammarMatch({
        block: PARAGRAPH,
        sentence: {
          unitIndex: 0,
          charStart: 0,
          charEnd: 19,
          rawText: 'She had left early.',
        },
        tokens: [
          { position: 0, charStart: 0, charEnd: 3 },
          { position: 1, charStart: 4, charEnd: 7 },
          { position: 2, charStart: 8, charEnd: 12 },
        ],
        match: { tokenStart: 1, tokenEnd: 3 },
      }),
    ).toEqual({ itemIndex: null, charStart: 4, charEnd: 12 });
  });

  it('reports the list item index for a list block', () => {
    const list: Block = {
      type: 'list',
      ordered: false,
      items: [
        { children: [{ type: 'text', text: 'First item.' }] },
        { children: [{ type: 'text', text: 'Second item.' }] },
      ],
    };
    expect(
      locateGrammarMatch({
        block: list,
        sentence: {
          unitIndex: 1,
          charStart: 0,
          charEnd: 12,
          rawText: 'Second item.',
        },
        tokens: [{ position: 0, charStart: 0, charEnd: 6 }],
        match: { tokenStart: 0, tokenEnd: 1 },
      }),
    ).toEqual({ itemIndex: 1, charStart: 0, charEnd: 6 });
  });

  it('returns null when the unit text no longer matches the sentence rawText', () => {
    expect(
      locateGrammarMatch({
        block: PARAGRAPH,
        sentence: {
          unitIndex: 0,
          charStart: 0,
          charEnd: 19,
          rawText: 'She had gone early.',
        },
        tokens: [{ position: 0, charStart: 0, charEnd: 3 }],
        match: { tokenStart: 0, tokenEnd: 1 },
      }),
    ).toBeNull();
  });

  it('returns null when the unit does not exist', () => {
    expect(
      locateGrammarMatch({
        block: PARAGRAPH,
        sentence: { unitIndex: 3, charStart: 0, charEnd: 3, rawText: 'She' },
        tokens: [{ position: 0, charStart: 0, charEnd: 3 }],
        match: { tokenStart: 0, tokenEnd: 1 },
      }),
    ).toBeNull();
  });

  it('returns null when the range covers no token', () => {
    expect(
      locateGrammarMatch({
        block: PARAGRAPH,
        sentence: {
          unitIndex: 0,
          charStart: 0,
          charEnd: 19,
          rawText: 'She had left early.',
        },
        tokens: [{ position: 0, charStart: 0, charEnd: 3 }],
        match: { tokenStart: 5, tokenEnd: 6 },
      }),
    ).toBeNull();
  });
});
