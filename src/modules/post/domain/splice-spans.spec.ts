import { DuplicateSpanInsertError } from '../errors/duplicate-span-insert.error.js';
import { OverlappingSpanInsertError } from '../errors/overlapping-span-insert.error.js';
import { SpanInsertOutOfNodeError } from '../errors/span-insert-out-of-node.error.js';
import type { ListItem, Paragraph } from './node-tree.types.js';
import {
  type SpanInsert,
  spliceSpans,
  spliceSpansIntoListItem,
} from './splice-spans.js';

describe('spliceSpans', () => {
  it('splits a TextNode into lead/span/trail pieces', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [{ type: 'text', text: 'The cat sat on the mat.' }],
    };
    const insert: SpanInsert = {
      start: 8,
      end: 11,
      kind: 'word',
      wordDefinitionId: 'wd-1',
      pos: 'verb',
    };

    const result = spliceSpans(paragraph, [insert]);

    expect(result.children).toEqual([
      { type: 'text', text: 'The cat ' },
      {
        type: 'span',
        text: 'sat',
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'verb',
      },
      { type: 'text', text: ' on the mat.' },
    ]);
  });

  it('splits a TextNode into lead/span/trail pieces for a phrase span', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [{ type: 'text', text: 'The cat sat on the mat.' }],
    };
    const insert: SpanInsert = {
      start: 8,
      end: 18,
      kind: 'phrase',
      phraseId: 'phrase-1',
    };

    const result = spliceSpans(paragraph, [insert]);

    expect(result.children).toEqual([
      { type: 'text', text: 'The cat ' },
      {
        type: 'span',
        text: 'sat on the',
        kind: 'phrase',
        phraseId: 'phrase-1',
      },
      { type: 'text', text: ' mat.' },
    ]);
  });

  it('carries the source TextNode marks onto the new SpanNode and the lead/trail pieces', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'The cat sat on the mat.', marks: ['bold'] },
      ],
    };

    const result = spliceSpans(paragraph, [
      {
        start: 8,
        end: 11,
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'verb',
      },
    ]);

    expect(result.children).toEqual([
      { type: 'text', text: 'The cat ', marks: ['bold'] },
      {
        type: 'span',
        text: 'sat',
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'verb',
        marks: ['bold'],
      },
      { type: 'text', text: ' on the mat.', marks: ['bold'] },
    ]);
  });

  it('splits a LinkNode, keeping href on the lead/trail pieces but not on the new span', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [
        { type: 'link', text: 'click here now', href: 'https://example.com' },
      ],
    };

    const result = spliceSpans(paragraph, [
      {
        start: 6,
        end: 10,
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'verb',
      },
    ]);

    expect(result.children).toEqual([
      { type: 'link', text: 'click ', href: 'https://example.com' },
      {
        type: 'span',
        text: 'here',
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'verb',
      },
      { type: 'link', text: ' now', href: 'https://example.com' },
    ]);
  });

  it('preserves the paragraph heading level on the returned paragraph', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      level: 2,
      children: [{ type: 'text', text: 'Breaking negotiate news' }],
    };

    const result = spliceSpans(paragraph, [
      {
        start: 9,
        end: 18,
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'verb',
      },
    ]);

    expect(result.level).toBe(2);
  });

  it('does not mutate the input paragraph', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [{ type: 'text', text: 'Hello world' }],
    };

    spliceSpans(paragraph, [
      { start: 0, end: 5, kind: 'word', wordDefinitionId: 'wd-1', pos: 'noun' },
    ]);

    expect(paragraph.children).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  it('overwrites only grammarConstruct on an existing span, leaving kind/wordDefinitionId/pos/text untouched', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [
        {
          type: 'span',
          text: 'negotiate',
          kind: 'word',
          wordDefinitionId: 'wd-1',
          pos: 'verb',
        },
      ],
    };
    const insert: SpanInsert = {
      start: 0,
      end: 9,
      kind: 'grammar_only',
      grammarConstruct: 'present_perfect',
    };

    const result = spliceSpans(paragraph, [insert]);

    expect(result.children).toEqual([
      {
        type: 'span',
        text: 'negotiate',
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'verb',
        grammarConstruct: 'present_perfect',
      },
    ]);
  });

  it('throws when an insert straddles two child nodes', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
    };

    expect(() =>
      spliceSpans(paragraph, [
        {
          start: 5,
          end: 8,
          kind: 'word',
          wordDefinitionId: 'wd-1',
          pos: 'noun',
        },
      ]),
    ).toThrow(SpanInsertOutOfNodeError);
  });

  it('throws when two inserts overlap within the same TextNode', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [{ type: 'text', text: 'abcdef' }],
    };

    expect(() =>
      spliceSpans(paragraph, [
        {
          start: 0,
          end: 3,
          kind: 'word',
          wordDefinitionId: 'wd-1',
          pos: 'noun',
        },
        {
          start: 2,
          end: 5,
          kind: 'word',
          wordDefinitionId: 'wd-2',
          pos: 'noun',
        },
      ]),
    ).toThrow(OverlappingSpanInsertError);
  });

  it('throws when two inserts target the same existing span', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [
        {
          type: 'span',
          text: 'negotiate',
          kind: 'word',
          wordDefinitionId: 'wd-1',
          pos: 'verb',
        },
      ],
    };

    expect(() =>
      spliceSpans(paragraph, [
        { start: 0, end: 9, kind: 'grammar_only', grammarConstruct: 'a' },
        { start: 0, end: 9, kind: 'grammar_only', grammarConstruct: 'b' },
      ]),
    ).toThrow(DuplicateSpanInsertError);
  });
});

describe('spliceSpansIntoListItem', () => {
  it('splices a word span into a list item, same as spliceSpans does for a paragraph', () => {
    const item: ListItem = {
      children: [{ type: 'text', text: 'Bring an umbrella.' }],
    };

    const result = spliceSpansIntoListItem(item, [
      {
        start: 9,
        end: 18,
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'noun',
      },
    ]);

    expect(result.children).toEqual([
      { type: 'text', text: 'Bring an ' },
      {
        type: 'span',
        text: 'umbrella.',
        kind: 'word',
        wordDefinitionId: 'wd-1',
        pos: 'noun',
      },
    ]);
  });

  it('does not mutate the input list item', () => {
    const item: ListItem = {
      children: [{ type: 'text', text: 'Hello world' }],
    };

    spliceSpansIntoListItem(item, [
      { start: 0, end: 5, kind: 'word', wordDefinitionId: 'wd-1', pos: 'noun' },
    ]);

    expect(item.children).toEqual([{ type: 'text', text: 'Hello world' }]);
  });
});
