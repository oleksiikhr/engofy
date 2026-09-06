import {
  paintGrammarConstruct,
  stripGrammarConstructs,
} from './apply-grammar-constructs.js';
import { flattenNodes } from './flatten.js';
import type { Block, Node } from './node-tree.types.js';

describe('paintGrammarConstruct', () => {
  it('wraps a plain-text slice in a grammar_only span', () => {
    // "By the time the war ended, she had drawn every coastline twice."
    const nodes: Node[] = [
      {
        type: 'text',
        text: 'By the time the war ended, she had drawn every coastline twice.',
      },
    ];
    // char offsets of "had drawn"
    const start = nodes[0].text.indexOf('had drawn');
    const end = start + 'had drawn'.length;

    const painted = paintGrammarConstruct(
      nodes,
      { start, end },
      'past-perfect',
    );

    expect(painted).toEqual([
      { type: 'text', text: 'By the time the war ended, she ' },
      {
        type: 'span',
        kind: 'grammar_only',
        text: 'had drawn',
        grammarConstruct: 'past-perfect',
      },
      { type: 'text', text: ' every coastline twice.' },
    ]);
  });

  it('sets grammarConstruct on a word span fully inside the range without nesting', () => {
    const nodes: Node[] = [
      { type: 'text', text: 'She ' },
      {
        type: 'span',
        kind: 'word',
        text: 'visited',
        wordDefinitionId: 'wd-1',
        pos: 'VERB',
      },
      { type: 'text', text: ' Tokyo.' },
    ];

    const painted = paintGrammarConstruct(
      nodes,
      { start: 0, end: 'She visited'.length },
      'past-simple',
    );

    expect(painted).toEqual([
      {
        type: 'span',
        kind: 'grammar_only',
        text: 'She ',
        grammarConstruct: 'past-simple',
      },
      {
        type: 'span',
        kind: 'word',
        text: 'visited',
        wordDefinitionId: 'wd-1',
        pos: 'VERB',
        grammarConstruct: 'past-simple',
      },
      { type: 'text', text: ' Tokyo.' },
    ]);
  });

  it('returns null when the range only partially covers a word span', () => {
    const nodes: Node[] = [
      { type: 'text', text: 'She ' },
      {
        type: 'span',
        kind: 'word',
        text: 'revisited',
        wordDefinitionId: 'wd-1',
        pos: 'VERB',
      },
      { type: 'text', text: ' Tokyo.' },
    ];

    // "She revis" — ends mid-word.
    expect(
      paintGrammarConstruct(nodes, { start: 0, end: 9 }, 'past-simple'),
    ).toBeNull();
  });

  it('returns null when the range touches a link node', () => {
    const nodes: Node[] = [
      { type: 'text', text: 'Read it on ' },
      { type: 'link', text: "the author's site", href: 'https://example.com' },
      { type: 'text', text: ' now.' },
    ];

    expect(
      paintGrammarConstruct(nodes, { start: 0, end: 20 }, 'imperative'),
    ).toBeNull();
  });

  it('lets a shorter construction win on the shared span (paint longest first)', () => {
    const nodes: Node[] = [
      { type: 'text', text: 'She had never visited Tokyo before.' },
    ];

    // longer span first: "had never visited Tokyo"
    const outer = paintGrammarConstruct(
      nodes,
      { start: 4, end: 27 },
      'past-perfect',
    );
    expect(outer).not.toBeNull();

    // then the nested shorter span: "visited"
    const inner = paintGrammarConstruct(
      outer as Node[],
      { start: 14, end: 21 },
      'past-simple',
    );

    expect(inner).toEqual([
      { type: 'text', text: 'She ' },
      {
        type: 'span',
        kind: 'grammar_only',
        text: 'had never ',
        grammarConstruct: 'past-perfect',
      },
      {
        type: 'span',
        kind: 'grammar_only',
        text: 'visited',
        grammarConstruct: 'past-simple',
      },
      {
        type: 'span',
        kind: 'grammar_only',
        text: ' Tokyo',
        grammarConstruct: 'past-perfect',
      },
      { type: 'text', text: ' before.' },
    ]);
  });

  it('keeps text marks on the wrapped slice', () => {
    const nodes: Node[] = [
      { type: 'text', text: 'She ' },
      { type: 'text', text: 'had left', marks: ['italic'] },
      { type: 'text', text: ' already.' },
    ];

    const painted = paintGrammarConstruct(
      nodes,
      { start: 4, end: 12 },
      'past-perfect',
    );

    expect(painted).toEqual([
      { type: 'text', text: 'She ' },
      {
        type: 'span',
        kind: 'grammar_only',
        text: 'had left',
        grammarConstruct: 'past-perfect',
        marks: ['italic'],
      },
      { type: 'text', text: ' already.' },
    ]);
  });

  it('anchors the range at sentence.charStart + span.charStart', () => {
    // A unit of two sentences; the grammar span is inside the second one.
    const unitText = 'A calm morning. She had walked for hours.';
    const nodes: Node[] = [{ type: 'text', text: unitText }];

    const sentenceCharStart = 'A calm morning. '.length;
    // span offsets are relative to the sentence's rawText ("She had walked ...")
    const spanCharStart = 'She '.length;
    const spanCharEnd = 'She had walked'.length;

    const painted = paintGrammarConstruct(
      nodes,
      {
        start: sentenceCharStart + spanCharStart,
        end: sentenceCharStart + spanCharEnd,
      },
      'past-perfect',
    );

    expect(painted).toEqual([
      { type: 'text', text: 'A calm morning. She ' },
      {
        type: 'span',
        kind: 'grammar_only',
        text: 'had walked',
        grammarConstruct: 'past-perfect',
      },
      { type: 'text', text: ' for hours.' },
    ]);
    // the wrapped slice is exactly the sentence-relative span
    const { text } = flattenNodes(painted as Node[]);
    expect(text).toBe(unitText);
  });
});

describe('stripGrammarConstructs', () => {
  it('is the inverse of a paint — round-trips to the pre-paint tree', () => {
    const original: Block = {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'She ' },
        {
          type: 'span',
          kind: 'word',
          text: 'visited',
          wordDefinitionId: 'wd-1',
          pos: 'VERB',
        },
        { type: 'text', text: ' Tokyo before that trip.' },
      ],
    };

    const painted: Block = {
      type: 'paragraph',
      children: paintGrammarConstruct(
        original.children as Node[],
        { start: 0, end: 'She visited'.length },
        'past-simple',
      ) as Node[],
    };

    expect(stripGrammarConstructs(painted)).toEqual(original);
  });

  it('collapses grammar_only spans and merges the freed text, keeping level / quote', () => {
    const painted: Block = {
      type: 'paragraph',
      quote: true,
      children: [
        { type: 'text', text: 'By the time the war ended, she ' },
        {
          type: 'span',
          kind: 'grammar_only',
          text: 'had drawn',
          grammarConstruct: 'past-perfect',
        },
        { type: 'text', text: ' every coastline twice.' },
      ],
    };

    expect(stripGrammarConstructs(painted)).toEqual({
      type: 'paragraph',
      quote: true,
      children: [
        {
          type: 'text',
          text: 'By the time the war ended, she had drawn every coastline twice.',
        },
      ],
    });
  });

  it('strips grammarConstruct from list-item spans', () => {
    const painted: Block = {
      type: 'list',
      ordered: false,
      items: [
        {
          children: [
            {
              type: 'span',
              kind: 'phrase',
              text: 'pack light',
              phraseId: 'p-1',
              grammarConstruct: 'imperative',
            },
            { type: 'text', text: ' when you travel.' },
          ],
        },
      ],
    };

    expect(stripGrammarConstructs(painted)).toEqual({
      type: 'list',
      ordered: false,
      items: [
        {
          children: [
            {
              type: 'span',
              kind: 'phrase',
              text: 'pack light',
              phraseId: 'p-1',
            },
            { type: 'text', text: ' when you travel.' },
          ],
        },
      ],
    });
  });
});
