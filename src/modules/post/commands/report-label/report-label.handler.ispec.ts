import { Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostNotFoundError } from '../../errors/post-not-found.error.js';
import { PostModule } from '../../post.module.js';
import { ReportLabelCommand } from './report-label.command.js';

describe('ReportLabelHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('logs a structured event for a published post', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const post = await suite.factories.post.createOne({
      status: PostStatus.Published,
    });
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
    const post = await suite.factories.post.createOne({
      status: PostStatus.Pending,
    });

    await expect(
      suite.command(
        new ReportLabelCommand(null, post.shortId, 'grammar', uuidv7()),
      ),
    ).rejects.toBeInstanceOf(PostNotFoundError);
  });
});
