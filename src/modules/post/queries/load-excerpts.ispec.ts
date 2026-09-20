import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { factories } from '../../../../test/factories/factories.js';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { PostPartKind } from '../enums/post-part-kind.enum.js';
import { PostModule } from '../post.module.js';
import { loadExcerpts } from './load-excerpts.js';

function seedPart(
  em: EntityManager,
  postId: string,
  blockIndex: number,
  text: string,
): void {
  factories(em).postPart.makeOne({
    postId,
    blockIndex,
    kind: PostPartKind.Paragraph,
    body: { type: 'paragraph', children: [{ type: 'text', text }] },
  });
}

describe('loadExcerpts', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns an empty map for no post ids, with no query', async () => {
    const excerpts = await loadExcerpts(suite.orm.em, []);
    expect(excerpts.size).toBe(0);
  });

  it('concatenates a post’s leading blocks in order', async () => {
    const em = suite.orm.em;
    const postId = randomUUID();
    seedPart(em, postId, 1, 'Second block.');
    seedPart(em, postId, 0, 'First block.');
    await em.flush();
    em.clear();

    const excerpts = await loadExcerpts(em, [postId]);
    expect(excerpts.get(postId)).toBe('First block. Second block.');
  });

  it('truncates on a word boundary at the max length', async () => {
    const em = suite.orm.em;
    const postId = randomUUID();
    const long = 'lorem ipsum dolor sit amet '.repeat(20).trim();
    seedPart(em, postId, 0, long);
    await em.flush();
    em.clear();

    const excerpt = (await loadExcerpts(em, [postId])).get(postId);
    expect(excerpt?.length).toBeLessThanOrEqual(281);
    expect(excerpt?.endsWith('…')).toBe(true);
    expect(excerpt).not.toContain('  ');
  });
});
