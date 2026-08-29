import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../embeddables/post-source.embeddable.js';
import { PostSourceFormat } from '../enums/post-source-format.enum.js';
import { PostStatus } from '../enums/post-status.enum.js';
import { Post } from './post.entity.js';

describe('Post entity', () => {
  const suite = createIntegrationSuite();

  it('round-trips the embedded source and enum-backed status through Postgres', async () => {
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'The government announced negotiate.';
    source.link = 'https://example.com/article';

    const post = new Post();
    post.source = source;
    suite.orm.em.persist(post);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const found = await suite.orm.em.findOneOrFail(Post, post.id);

    expect(found.source.format).toBe(PostSourceFormat.Text);
    expect(found.source.rawText).toBe('The government announced negotiate.');
    expect(found.source.link).toBe('https://example.com/article');
    expect(found.status).toBe(PostStatus.Pending);
  });
});
