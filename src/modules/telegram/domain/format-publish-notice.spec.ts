import { formatPublishNotice } from './format-publish-notice.js';

describe('formatPublishNotice', () => {
  it('gives the title and the public url built from slug and short id', () => {
    expect(
      formatPublishNotice(
        { title: ' My Post ', slug: 'my-post', shortId: 'abc123' },
        'https://engofy.test/',
      ),
    ).toBe('Post published: My Post\nhttps://engofy.test/posts/my-post-abc123');
  });

  it('falls back to the short id without a title or slug', () => {
    expect(
      formatPublishNotice({ shortId: 'abc123' }, 'https://engofy.test'),
    ).toBe('Post published: abc123\nhttps://engofy.test/posts/abc123');
  });
});
