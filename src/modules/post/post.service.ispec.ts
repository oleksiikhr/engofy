import { createIntegrationSuite } from '../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../core/queue/queue-names.enum.js';
import { IngestPostDto } from './commands/ingest-post/ingest-post.dto.js';
import type { PostAnnotationJobData } from './commands/ingest-post/ingest-post.handler.js';
import { Post } from './entities/post.entity.js';
import { PostStatus } from './enums/post-status.enum.js';
import { PostModule } from './post.module.js';
import { PostService } from './post.service.js';

describe('PostService', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });
  const queue = useQueueSpy(suite);

  describe('ingest', () => {
    it('persists the ingested post and flushes it', async () => {
      const service = suite.moduleRef.get(PostService);

      const post = await service.ingest(
        IngestPostDto.create({ rawText: 'Some plain text.' }),
      );

      expect(post.id).toBeDefined();
      expect(post.status).toBe(PostStatus.Pending);

      suite.orm.em.clear();
      const reloaded = await suite.orm.em.findOneOrFail(Post, post.id);
      expect(reloaded).toBeDefined();
    });

    it('enqueues an annotation job for the ingested post', async () => {
      const service = suite.moduleRef.get(PostService);

      const post = await service.ingest(
        IngestPostDto.create({ rawText: 'Another plain text.' }),
      );

      queue.assertSent<PostAnnotationJobData>(
        QueueName.PostAnnotation,
        (data) => data.postId === post.id,
      );
    });
  });
});
