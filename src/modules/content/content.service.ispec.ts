import { createIntegrationSuite } from '../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../core/queue/queue-names.enum.js';
import { IngestContentDto } from './commands/ingest-content/ingest-content.dto.js';
import type { ContentAnnotationJobData } from './commands/ingest-content/ingest-content.handler.js';
import { ContentModule } from './content.module.js';
import { ContentService } from './content.service.js';
import { Content } from './entities/content.entity.js';
import { ContentStatus } from './enums/content-status.enum.js';

describe('ContentService', () => {
  const suite = createIntegrationSuite({ imports: [ContentModule] });
  const queue = useQueueSpy(suite);

  describe('ingest', () => {
    it('persists the ingested content and flushes it', async () => {
      const service = suite.moduleRef.get(ContentService);

      const content = await service.ingest(
        IngestContentDto.create({ rawText: 'Some plain text.' }),
      );

      expect(content.id).toBeDefined();
      expect(content.status).toBe(ContentStatus.Pending);

      suite.orm.em.clear();
      const reloaded = await suite.orm.em.findOneOrFail(Content, content.id);
      expect(reloaded).toBeDefined();
    });

    it('enqueues an annotation job for the ingested content', async () => {
      const service = suite.moduleRef.get(ContentService);

      const content = await service.ingest(
        IngestContentDto.create({ rawText: 'Another plain text.' }),
      );

      queue.assertSent<ContentAnnotationJobData>(
        QueueName.ContentAnnotation,
        (data) => data.contentId === content.id,
      );
    });
  });
});
