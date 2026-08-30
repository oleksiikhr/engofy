import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { assembleDocFromParts } from '../../domain/post-parts.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostSourceType } from '../../enums/post-source-type.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { IngestPostCommand } from './ingest-post.command.js';
import { IngestPostDto } from './ingest-post.dto.js';
import type { PostSpacyParseJobData } from './ingest-post.handler.js';

describe('IngestPostHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });
  const queue = useQueueSpy(suite);

  it('ingests plain text, auto-detecting the format, and enqueues the spacy_parse entry point', async () => {
    const post = await suite.command(
      new IngestPostCommand(
        IngestPostDto.create({
          rawText: 'Just a plain sentence with no markup at all.',
          title: 'Plain title',
        }),
      ),
    );

    expect(post.source.format).toBe(PostSourceFormat.Text);
    expect(post.status).toBe(PostStatus.Pending);

    const parts = await suite.orm.em.find(PostPart, {
      postId: post.id,
    });
    expect(parts.length).toBeGreaterThan(0);
    expect(assembleDocFromParts(parts).type).toBe('doc');

    queue.assertSent<PostSpacyParseJobData>(
      QueueName.PostSpacyParse,
      (data) => data.postId === post.id,
    );
    // annotation now hangs off spacy_parse's completion, not ingest.
    queue.assertNotSent(QueueName.PostAnnotation);
  });

  it('auto-detects markdown from post shape, no format passed in', async () => {
    const post = await suite.command(
      new IngestPostCommand(
        IngestPostDto.create({
          rawText: '# Heading\n\nSome **bold** text.',
        }),
      ),
    );

    expect(post.source.format).toBe(PostSourceFormat.Markdown);
  });

  it('auto-detects html from post shape, no format passed in', async () => {
    const post = await suite.command(
      new IngestPostCommand(
        IngestPostDto.create({
          rawText: '<p>Hello <strong>world</strong>.</p>',
        }),
      ),
    );

    expect(post.source.format).toBe(PostSourceFormat.Html);
  });

  it('stores the given link on the source, unset by default', async () => {
    const link = `https://example.com/${randomUUID()}`;

    const post = await suite.command(
      new IngestPostCommand(
        IngestPostDto.create({ rawText: 'Some text.', link }),
      ),
    );

    expect(post.source.link).toBe(link);
  });

  it('defaults source type to original and derives attribution from the link (PLAN.md §9)', async () => {
    const link = `https://example.com/${randomUUID()}`;

    const post = await suite.command(
      new IngestPostCommand(
        IngestPostDto.create({ rawText: 'Some text.', link }),
      ),
    );

    expect(post.source.type).toBe(PostSourceType.Original);
    expect(post.source.attributionText).toBe(link);
  });

  it('stores an explicit source type and attribution line', async () => {
    const post = await suite.command(
      new IngestPostCommand(
        IngestPostDto.create({
          rawText: 'A quoted opinion.',
          sourceType: PostSourceType.RedditComment,
          attributionText: 'r/books comment by u/someone',
        }),
      ),
    );

    expect(post.source.type).toBe(PostSourceType.RedditComment);
    expect(post.source.attributionText).toBe('r/books comment by u/someone');
  });

  it('falls back to a generic attribution label when nothing is provided', async () => {
    const post = await suite.command(
      new IngestPostCommand(
        IngestPostDto.create({ rawText: 'Plain original text.' }),
      ),
    );

    expect(post.source.type).toBe(PostSourceType.Original);
    expect(post.source.attributionText).toBe('Original content');
  });
});
