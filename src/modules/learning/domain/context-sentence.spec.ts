import type { Block } from '../../post/domain/node-tree.types.js';
import { indexBlockSpans, sentenceContainsSpan } from './context-sentence.js';

describe('indexBlockSpans', () => {
  it('indexes a word span by wordDefinitionId, keyed like a card target', () => {
    const block: Block = {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'She ' },
        {
          type: 'span',
          kind: 'word',
          text: 'runs',
          wordDefinitionId: 'wd1',
          pos: 'VERB',
        },
        { type: 'text', text: ' fast.' },
      ],
    };

    const index = indexBlockSpans(block);

    expect(index.get('word:wd1')).toEqual({ unitIndex: 0, start: 4, end: 8 });
  });

  it('indexes a phrase span by phraseId', () => {
    const block: Block = {
      type: 'paragraph',
      children: [
        { type: 'span', kind: 'phrase', text: 'gives up', phraseId: 'ph1' },
        { type: 'text', text: ' easily.' },
      ],
    };

    const index = indexBlockSpans(block);

    expect(index.get('phrase:ph1')).toEqual({ unitIndex: 0, start: 0, end: 8 });
  });

  it('ignores grammar_only spans — no key to index them under', () => {
    const block: Block = {
      type: 'paragraph',
      children: [{ type: 'span', kind: 'grammar_only', text: 'had gone' }],
    };

    expect(indexBlockSpans(block).size).toBe(0);
  });

  it('indexes each list item as its own unitIndex', () => {
    const block: Block = {
      type: 'list',
      ordered: false,
      items: [
        {
          children: [
            { type: 'text', text: 'x ' },
            {
              type: 'span',
              kind: 'word',
              text: 'run',
              wordDefinitionId: 'wd1',
              pos: 'VERB',
            },
          ],
        },
        {
          children: [
            {
              type: 'span',
              kind: 'word',
              text: 'ran',
              wordDefinitionId: 'wd2',
              pos: 'VERB',
            },
          ],
        },
      ],
    };

    const index = indexBlockSpans(block);

    expect(index.get('word:wd1')).toEqual({ unitIndex: 0, start: 2, end: 5 });
    expect(index.get('word:wd2')).toEqual({ unitIndex: 1, start: 0, end: 3 });
  });

  it('keeps the first occurrence when a span repeats in the same block', () => {
    const block: Block = {
      type: 'paragraph',
      children: [
        {
          type: 'span',
          kind: 'word',
          text: 'run',
          wordDefinitionId: 'wd1',
          pos: 'VERB',
        },
        { type: 'text', text: ' and ' },
        {
          type: 'span',
          kind: 'word',
          text: 'run',
          wordDefinitionId: 'wd1',
          pos: 'VERB',
        },
      ],
    };

    expect(indexBlockSpans(block).get('word:wd1')).toEqual({
      unitIndex: 0,
      start: 0,
      end: 3,
    });
  });
});

describe('sentenceContainsSpan', () => {
  it('is true when the span range falls inside the sentence range', () => {
    expect(
      sentenceContainsSpan(
        { charStart: 0, charEnd: 20 },
        { unitIndex: 0, start: 4, end: 8 },
      ),
    ).toBe(true);
  });

  it('is false when the span range is outside the sentence range', () => {
    expect(
      sentenceContainsSpan(
        { charStart: 20, charEnd: 40 },
        { unitIndex: 0, start: 4, end: 8 },
      ),
    ).toBe(false);
  });

  it('is false for a sentence merely adjacent to the span (touching, not overlapping)', () => {
    expect(
      sentenceContainsSpan(
        { charStart: 8, charEnd: 20 },
        { unitIndex: 0, start: 4, end: 8 },
      ),
    ).toBe(false);
  });
});
