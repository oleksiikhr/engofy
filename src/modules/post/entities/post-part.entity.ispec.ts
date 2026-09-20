import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import type { ListBlock, Paragraph } from '../domain/node-tree.types.js';
import { PostPartKind } from '../enums/post-part-kind.enum.js';
import { PostPart } from './post-part.entity.js';

describe('PostPart entity', () => {
  const suite = createIntegrationSuite();

  it('round-trips a jsonb paragraph body through Postgres', async () => {
    const body: Paragraph = {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'The government announced ' },
        {
          type: 'span',
          text: 'negotiate',
          kind: 'word',
          wordDefinitionId: 'wd-1',
          pos: 'verb',
        },
      ],
    };

    const part = suite.factories.postPart.makeOne({
      postId: crypto.randomUUID(),
      blockIndex: 0,
      kind: PostPartKind.Paragraph,
      body,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const found = await suite.orm.em.findOneOrFail(PostPart, part.id);

    expect(found.kind).toBe(PostPartKind.Paragraph);
    expect(found.body).toEqual(body);
  });

  it('round-trips a whole ListBlock (all items) as one jsonb body', async () => {
    const body: ListBlock = {
      type: 'list',
      ordered: true,
      items: [
        { children: [{ type: 'text', text: 'One.' }] },
        { children: [{ type: 'text', text: 'Two.' }] },
      ],
    };

    const part = suite.factories.postPart.makeOne({
      postId: crypto.randomUUID(),
      blockIndex: 0,
      kind: PostPartKind.List,
      body,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const found = await suite.orm.em.findOneOrFail(PostPart, part.id);

    expect(found.kind).toBe(PostPartKind.List);
    expect(found.body).toEqual(body);
  });
});
