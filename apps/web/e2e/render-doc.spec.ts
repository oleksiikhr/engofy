import { expect, test } from '@playwright/test';
import { renderDoc } from '../src/lib/render-doc';
import type {
  Doc,
  InlineNode,
  PostDetail,
  ReaderToken,
} from '../src/lib/types';

// renderDoc is pure, so the reader's render bugs are checked without a browser.

function token(
  charStart: number,
  charEnd: number,
  pos: string,
  tense: ReaderToken['tense'] = null,
): ReaderToken {
  return {
    blockIndex: 0,
    itemIndex: null,
    charStart,
    charEnd,
    pos,
    tense,
    irregular: null,
  };
}

function annotations(
  overrides: Partial<PostDetail['annotations']>,
): PostDetail['annotations'] {
  return {
    words: {},
    phrases: {},
    grammar: {},
    tokens: [],
    grammarMatches: [],
    ...overrides,
  } as PostDetail['annotations'];
}

function paragraph(children: InlineNode[]): Doc {
  return { children: [{ type: 'paragraph', children }] } as Doc;
}

test.describe('renderDoc', () => {
  test('keeps a clitic inside its head token span', async () => {
    // "It's simple": It = 0-2, 's = 2-4, simple = 5-11
    const html = renderDoc(
      paragraph([{ type: 'text', text: "It's simple" }]),
      annotations({
        tokens: [
          token(0, 2, 'PRON'),
          token(2, 4, 'AUX', 'present'),
          token(5, 11, 'ADJ'),
        ],
      }),
    );
    expect(html).toContain('>It&#39;s</span>');
    expect(html.match(/data-tok/g)).toHaveLength(2);
  });

  test('renders a clitic after a span node as plain text, not a token', async () => {
    // "farmers' market" with `farmers` a word span: the apostrophe sits in the
    // next text node.
    const html = renderDoc(
      paragraph([
        {
          type: 'span',
          kind: 'word',
          text: 'farmers',
          wordDefinitionId: 'w1',
          pos: 'NOUN',
        },
        { type: 'text', text: "' market" },
      ]),
      annotations({
        words: { w1: { state: 'new' } },
        tokens: [
          token(0, 7, 'NOUN'),
          token(7, 8, 'PART'),
          token(9, 15, 'NOUN'),
        ],
      } as never),
    );
    expect(html).toContain('</span></span>&#39; <span data-tok');
    expect(html.match(/data-tok/g)).toHaveLength(2);
  });

  test('wraps consecutive nodes of one grammar match in a single span', async () => {
    // "wakes up": two phrase spans with the space between them, all one match.
    const html = renderDoc(
      paragraph([
        { type: 'span', kind: 'phrase', text: 'wakes', phraseId: 'p1' },
        { type: 'text', text: ' ' },
        { type: 'span', kind: 'phrase', text: 'up', phraseId: 'p1' },
      ]),
      annotations({
        phrases: { p1: { state: 'new' } },
        grammarMatches: [
          {
            blockIndex: 0,
            itemIndex: null,
            charStart: 0,
            charEnd: 8,
            grammarUsagePointId: 'g1',
            state: 'new',
          },
        ],
      } as never),
    );
    expect(html.match(/data-grammar-usage-point-id="g1"/g)).toHaveLength(1);
    expect(html).toContain('</span> <span data-phrase-id="p1">');
  });
  test('flags labels at or below the reader level as quiet', async () => {
    const doc = paragraph([
      {
        type: 'span',
        kind: 'word',
        text: 'easy',
        wordDefinitionId: 'w1',
        pos: 'NOUN',
      },
      { type: 'text', text: ' ' },
      {
        type: 'span',
        kind: 'word',
        text: 'hard',
        wordDefinitionId: 'w2',
        pos: 'NOUN',
      },
      { type: 'text', text: ' ' },
      {
        type: 'span',
        kind: 'word',
        text: 'odd',
        wordDefinitionId: 'w3',
        pos: 'NOUN',
      },
    ]);
    const words = {
      w1: { state: 'new', cefrLevel: 'A2' },
      w2: { state: 'new', cefrLevel: 'C1' },
      w3: { state: 'new', cefrLevel: null },
    };
    const html = renderDoc(doc, annotations({ words } as never), 'B1');
    expect(html).toContain('data-word-definition-id="w1" data-quiet');
    expect(html).toMatch(/data-word-definition-id="w2">/);
    expect(html).toMatch(/data-word-definition-id="w3">/);
    // No reader level: nothing is quiet.
    expect(renderDoc(doc, annotations({ words } as never))).not.toContain(
      'data-quiet',
    );
  });

  test('leaves a proper noun without a label', async () => {
    const html = renderDoc(
      paragraph([
        {
          type: 'span',
          kind: 'word',
          text: 'Maria',
          wordDefinitionId: 'w1',
          pos: 'NOUN',
        },
      ]),
      annotations({
        words: { w1: { state: 'new', pos: 'proper_noun' } },
      } as never),
    );
    expect(html).not.toContain('data-word-definition-id');
    expect(html).toContain('Maria');
  });
});
