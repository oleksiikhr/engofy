import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { ContentModule } from '../../content.module.js';
import { assembleDocFromParts } from '../../domain/content-parts.js';
import { ContentPart } from '../../entities/content-part.entity.js';
import { ContentSourceFormat } from '../../enums/content-source-format.enum.js';
import { ContentStatus } from '../../enums/content-status.enum.js';
import { IngestContentCommand } from './ingest-content.command.js';
import { IngestContentDto } from './ingest-content.dto.js';
import type { ContentAnnotationJobData } from './ingest-content.handler.js';

describe('IngestContentHandler', () => {
  const suite = createIntegrationSuite({ imports: [ContentModule] });
  const queue = useQueueSpy(suite);

  it('ingests plain text, auto-detecting the format, and enqueues annotation', async () => {
    const content = await suite.command(
      new IngestContentCommand(
        IngestContentDto.create({
          rawText: 'Just a plain sentence with no markup at all.',
          title: 'Plain title',
        }),
      ),
    );

    expect(content.source.format).toBe(ContentSourceFormat.Text);
    expect(content.status).toBe(ContentStatus.Pending);

    const parts = await suite.orm.em.find(ContentPart, {
      contentId: content.id,
    });
    expect(parts.length).toBeGreaterThan(0);
    expect(assembleDocFromParts(parts).type).toBe('doc');

    queue.assertSent<ContentAnnotationJobData>(
      QueueName.ContentAnnotation,
      (data) => data.contentId === content.id,
    );
  });

  it('auto-detects markdown from content shape, no format passed in', async () => {
    const content = await suite.command(
      new IngestContentCommand(
        IngestContentDto.create({
          rawText: '# Heading\n\nSome **bold** text.',
        }),
      ),
    );

    expect(content.source.format).toBe(ContentSourceFormat.Markdown);
  });

  it('auto-detects html from content shape, no format passed in', async () => {
    const content = await suite.command(
      new IngestContentCommand(
        IngestContentDto.create({
          rawText: '<p>Hello <strong>world</strong>.</p>',
        }),
      ),
    );

    expect(content.source.format).toBe(ContentSourceFormat.Html);
  });

  it('stores the given link on the source, unset by default', async () => {
    const link = `https://example.com/${randomUUID()}`;

    const content = await suite.command(
      new IngestContentCommand(
        IngestContentDto.create({ rawText: 'Some text.', link }),
      ),
    );

    expect(content.source.link).toBe(link);
  });
});
