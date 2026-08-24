import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { ContentSource } from '../embeddables/content-source.embeddable.js';
import { ContentSourceFormat } from '../enums/content-source-format.enum.js';
import { ContentStatus } from '../enums/content-status.enum.js';
import { Content } from './content.entity.js';

describe('Content entity', () => {
  const suite = createIntegrationSuite();

  it('round-trips the embedded source and enum-backed status through Postgres', async () => {
    const source = new ContentSource();
    source.format = ContentSourceFormat.Text;
    source.rawText = 'The government announced negotiate.';
    source.link = 'https://example.com/article';

    const content = new Content();
    content.source = source;
    suite.orm.em.persist(content);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const found = await suite.orm.em.findOneOrFail(Content, content.id);

    expect(found.source.format).toBe(ContentSourceFormat.Text);
    expect(found.source.rawText).toBe('The government announced negotiate.');
    expect(found.source.link).toBe('https://example.com/article');
    expect(found.status).toBe(ContentStatus.Pending);
  });
});
