import {
  formatPostAnnouncement,
  postPublicPath,
} from './format-announcement.js';

describe('postPublicPath', () => {
  it('uses slug-shortId when a slug exists', () => {
    expect(postPublicPath({ slug: 'moving-cities', shortId: 'abc123' })).toBe(
      '/posts/moving-cities-abc123',
    );
  });

  it('falls back to shortId alone without a slug', () => {
    expect(postPublicPath({ slug: null, shortId: 'abc123' })).toBe(
      '/posts/abc123',
    );
  });
});

describe('formatPostAnnouncement', () => {
  it('renders title, CEFR badge and absolute url', () => {
    expect(
      formatPostAnnouncement(
        {
          title: 'Moving to a New City',
          slug: 'moving-to-a-new-city',
          shortId: 'x1y2',
          cefrLevel: 'B2',
        },
        'https://engofy.com/',
      ),
    ).toBe(
      'Moving to a New City\n\nLevel: B2\n\nhttps://engofy.com/posts/moving-to-a-new-city-x1y2',
    );
  });

  it('omits the CEFR line when the post has no level yet', () => {
    expect(
      formatPostAnnouncement(
        { title: 'Untitled', slug: null, shortId: 'q9', cefrLevel: null },
        'https://engofy.com',
      ),
    ).toBe('Untitled\n\nhttps://engofy.com/posts/q9');
  });

  it('uses a fallback headline when there is no title', () => {
    const text = formatPostAnnouncement(
      { title: null, slug: null, shortId: 'q9' },
      'https://engofy.com',
    );
    expect(text.startsWith('New reading\n\n')).toBe(true);
  });
});
