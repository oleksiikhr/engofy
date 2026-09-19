import type { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostNotFoundError } from '../../errors/post-not-found.error.js';
import { PostModule } from '../../post.module.js';
import { ReportLabelCommand } from './report-label.command.js';

async function seedPost(em: EntityManager, status: PostStatus): Promise<Post> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  post.status = status;
  em.persist(post);
  await em.flush();
  return post;
}

describe('ReportLabelHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('logs a structured event for a published post', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const post = await seedPost(suite.orm.em, PostStatus.Published);
    const targetId = uuidv7();

    await suite.command(
      new ReportLabelCommand(null, post.shortId, 'word', targetId),
    );

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reader_label_report',
        postId: post.id,
        userId: null,
        kind: 'word',
        targetId,
      }),
      expect.any(String),
    );
    warn.mockRestore();
  });

  it('rejects a post that is not published', async () => {
    const post = await seedPost(suite.orm.em, PostStatus.Pending);

    await expect(
      suite.command(
        new ReportLabelCommand(null, post.shortId, 'grammar', uuidv7()),
      ),
    ).rejects.toBeInstanceOf(PostNotFoundError);
  });
});
