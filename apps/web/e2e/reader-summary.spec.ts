import { expect, test } from '@playwright/test';
import type { LexiconData } from '../src/lib/reader-lexicon';
import {
  pickNextPost,
  readingMinutes,
  seenSummary,
} from '../src/lib/reader-summary';
import type { Doc, PostsListItem } from '../src/lib/types';

// reader-summary is pure, so it is checked without a browser.

function doc(...texts: string[]): Doc {
  return {
    type: 'doc',
    children: texts.map((text) => ({
      type: 'paragraph',
      children: [{ type: 'text', text }],
    })),
  };
}

function item(shortId: string): PostsListItem {
  return {
    shortId,
    slug: null,
    title: shortId,
    cefrLevel: 'B1',
    topic: null,
    publishedAt: '2026-09-20T00:00:00Z',
    excerpt: '',
    sourceLink: null,
    attributionText: '',
    sourceType: 'original',
    isRead: false,
  };
}

test('readingMinutes rounds 200 words a minute and never drops below one', () => {
  expect(readingMinutes(doc('a short text'))).toBe(1);
  expect(readingMinutes(doc(Array(500).fill('word').join(' ')))).toBe(3);
  expect(
    readingMinutes({
      type: 'doc',
      children: [
        {
          type: 'list',
          ordered: false,
          items: [{ children: [{ type: 'text', text: 'one two' }] }],
        },
      ],
    }),
  ).toBe(1);
});

test('seenSummary lists new words and phrases and distinct constructions, capped', () => {
  const words: LexiconData['words'] = {};
  for (let i = 0; i < 10; i++) {
    words[`w${i}`] = {
      kind: 'word',
      id: `w${i}`,
      lemma: `lemma${i}`,
      pos: 'noun',
      phonetic: null,
      frequencyRank: null,
      definition: null,
      example: null,
      translations: {},
      cefrLevel: 'B1',
      state: i === 0 ? 'learned' : 'new',
    };
  }
  const grammar = (id: string, construction: string) =>
    ({
      id,
      construction,
      state: 'new',
    }) as unknown as LexiconData['grammar'][string];
  const summary = seenSummary({
    words,
    phrases: {},
    grammar: {
      a: grammar('a', 'past perfect'),
      b: grammar('b', 'past perfect'),
      c: grammar('c', 'reported speech'),
    },
  });

  expect(summary.words).toHaveLength(8);
  expect(summary.words).not.toContain('lemma0');
  expect(summary.wordsMore).toBe(1);
  expect(summary.grammar).toEqual(['Past perfect', 'Reported speech']);
  expect(summary.grammarMore).toBe(0);
});

test('pickNextPost skips the current post', () => {
  expect(pickNextPost([item('a'), item('b')], 'a')?.shortId).toBe('b');
  expect(pickNextPost([item('a')], 'a')).toBeNull();
  expect(pickNextPost([], 'a')).toBeNull();
});
