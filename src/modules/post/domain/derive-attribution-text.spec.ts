import { PostSourceType } from '../enums/post-source-type.enum.js';
import { deriveAttributionText } from './derive-attribution-text.js';

describe('deriveAttributionText', () => {
  it('prefers an explicit, trimmed attribution line', () => {
    expect(
      deriveAttributionText({
        attributionText: '  Excerpt from Dune, Frank Herbert  ',
        link: 'https://example.com/dune',
        sourceType: PostSourceType.Excerpt,
      }),
    ).toBe('Excerpt from Dune, Frank Herbert');
  });

  it('falls back to the link when no explicit text is given', () => {
    expect(
      deriveAttributionText({
        link: 'https://reddit.com/r/books/comments/x',
        sourceType: PostSourceType.RedditComment,
      }),
    ).toBe('https://reddit.com/r/books/comments/x');
  });

  it('treats a blank explicit text as absent', () => {
    expect(
      deriveAttributionText({
        attributionText: '   ',
        link: 'https://example.com/a',
        sourceType: PostSourceType.NewsSnippet,
      }),
    ).toBe('https://example.com/a');
  });

  it('falls back to a type-specific label when there is no text and no link', () => {
    expect(deriveAttributionText({ sourceType: PostSourceType.Original })).toBe(
      'Original content',
    );
    expect(
      deriveAttributionText({ sourceType: PostSourceType.RedditComment }),
    ).toBe('Reddit comment');
  });
});
