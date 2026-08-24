import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import type { ListBlock, Paragraph } from '../domain/node-tree.types.js';
import { ContentPartKind } from '../enums/content-part-kind.enum.js';
import { ContentPart } from './content-part.entity.js';

describe('ContentPart entity', () => {
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

    const part = new ContentPart();
    part.contentId = crypto.randomUUID();
    part.blockIndex = 0;
    part.kind = ContentPartKind.Paragraph;
    part.body = body;
    suite.orm.em.persist(part);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const found = await suite.orm.em.findOneOrFail(ContentPart, part.id);

    expect(found.kind).toBe(ContentPartKind.Paragraph);
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

    const part = new ContentPart();
    part.contentId = crypto.randomUUID();
    part.blockIndex = 0;
    part.kind = ContentPartKind.List;
    part.body = body;
    suite.orm.em.persist(part);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const found = await suite.orm.em.findOneOrFail(ContentPart, part.id);

    expect(found.kind).toBe(ContentPartKind.List);
    expect(found.body).toEqual(body);
  });
});
