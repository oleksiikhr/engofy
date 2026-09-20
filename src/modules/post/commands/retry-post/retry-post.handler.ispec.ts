import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { factories } from '../../../../../test/factories/factories.js';
import { makeGrammarUsagePoint } from '../../../../../test/helpers/reference-data.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPublication } from '../../entities/post-publication.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { ExerciseSource } from '../../enums/exercise-source.enum.js';
import { ExerciseType } from '../../enums/exercise-type.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PublicationPlatform } from '../../enums/publication-platform.enum.js';
import { PublicationStatus } from '../../enums/publication-status.enum.js';
import { PostModule } from '../../post.module.js';
import { RetryPostCommand } from './retry-post.command.js';

interface SeededPost {
  postId: string;
  sentenceId: string;
}

async function seedProcessedPost(em: EntityManager): Promise<SeededPost> {
  const source = { format: PostSourceFormat.Text, rawText: 'Some text.' };
  const post = factories(em).post.makeOne({
    source,
    status: PostStatus.Published,
  });

  const part = factories(em).postPart.makeOne({
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [{ type: 'text', text: 'Some text.' }],
    },
    annotatedAt: DateTime.now(),
  });

  const sentence = factories(em).sentence.makeOne({
    postId: post.id,
    postPartId: part.id,
    unitIndex: 0,
    position: 0,
    rawText: 'Some text.',
    charStart: 0,
    charEnd: 10,
  });

  const _token = factories(em).sentenceToken.makeOne({
    sentenceId: sentence.id,
    position: 0,
    text: 'Some',
    charStart: 0,
    charEnd: 4,
    lemma: 'some',
    pos: 'DET',
    tag: 'DT',
    dep: 'det',
    morph: {},
  });

  const _match = factories(em).grammarMatch.makeOne({
    sentenceId: sentence.id,
    grammarUsagePointId: makeGrammarUsagePoint(factories(em)).id,
    tokenStart: 0,
    tokenEnd: 1,
  });

  const _exercise = factories(em).exercise.makeOne({
    postId: post.id,
    type: ExerciseType.GrammarContrastive,
    source: ExerciseSource.Ai,
    payload: {},
  });

  for (const [stage, status] of [
    [PostPipelineStage.SpacyParse, PostPipelineRunStatus.Completed],
    [PostPipelineStage.AiGrammar, PostPipelineRunStatus.Failed],
  ] as const) {
    const _run = factories(em).postPipelineRun.makeOne({
      postId: post.id,
      stage,
      status,
      completedAt: DateTime.now(),
    });
  }

  await em.flush();
  return { postId: post.id, sentenceId: sentence.id };
}

describe('RetryPostHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });
  const queue = useQueueSpy(suite);

  it('clears the pipeline runs, resets to pending, and re-enqueues only spacy_parse', async () => {
    const { postId } = await seedProcessedPost(suite.orm.em);

    await suite.command(new RetryPostCommand(postId));

    expect(await suite.orm.em.count(PostPipelineRun, { postId })).toBe(0);
    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Pending);

    queue.assertSent<{ postId: string }>(
      QueueName.PostSpacyParse,
      (d) => d.postId === postId,
    );
    queue.assertNotSent(QueueName.PostAnnotation);
  });

  it('wipes every downstream artefact so retry is always from scratch (D5)', async () => {
    const { postId, sentenceId } = await seedProcessedPost(suite.orm.em);

    await suite.command(new RetryPostCommand(postId));

    expect(await suite.orm.em.count(Sentence, { postId })).toBe(0);
    expect(await suite.orm.em.count(Exercise, { postId })).toBe(0);
    expect(await suite.orm.em.count(SentenceToken, { sentenceId })).toBe(0);
    expect(await suite.orm.em.count(GrammarMatch, { sentenceId })).toBe(0);

    const parts = await suite.orm.em.find(PostPart, { postId });
    expect(parts).toHaveLength(1);
    expect(parts[0].annotatedAt).toBeNull();
  });

  it('strips annotation spans from the post body so re-annotation starts from bare text', async () => {
    const { postId } = await seedProcessedPost(suite.orm.em);
    const seeded = await suite.orm.em.findOneOrFail(PostPart, { postId });
    seeded.body = {
      type: 'paragraph',
      children: [
        {
          type: 'span',
          kind: 'word',
          text: 'Some',
          wordDefinitionId: 'w1',
          pos: 'DET',
          grammarConstruct: 'determiners',
        },
        { type: 'text', text: ' text.' },
      ],
    };
    await suite.orm.em.flush();

    await suite.command(new RetryPostCommand(postId));

    suite.orm.em.clear();
    const part = await suite.orm.em.findOneOrFail(PostPart, { postId });
    expect(part.body).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', text: 'Some text.' }],
    });
  });

  it('is a no-op-safe reset when the post has no artefacts yet', async () => {
    const source = { format: PostSourceFormat.Text, rawText: 'x' };
    const post = suite.factories.post.makeOne({
      source,
      status: PostStatus.Failed,
    });
    await suite.orm.em.flush();

    await suite.command(new RetryPostCommand(post.id));

    const reloaded = await suite.orm.em.findOneOrFail(Post, post.id);
    expect(reloaded.status).toBe(PostStatus.Pending);
    queue.assertSent<{ postId: string }>(
      QueueName.PostSpacyParse,
      (d) => d.postId === post.id,
    );
  });

  it('clears failureNotifiedAt so a later failure alerts the admin again', async () => {
    const { postId } = await seedProcessedPost(suite.orm.em);
    const seeded = await suite.orm.em.findOneOrFail(Post, postId);
    seeded.status = PostStatus.Failed;
    seeded.failureNotifiedAt = DateTime.now();
    await suite.orm.em.flush();

    await suite.command(new RetryPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.failureNotifiedAt).toBeNull();
  });

  it('clears publishNotifiedAt so a re-published post notifies the admin again', async () => {
    const { postId } = await seedProcessedPost(suite.orm.em);
    const seeded = await suite.orm.em.findOneOrFail(Post, postId);
    seeded.publishNotifiedAt = DateTime.now();
    await suite.orm.em.flush();

    await suite.command(new RetryPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.publishNotifiedAt).toBeNull();
  });

  it('resets a failed telegram publication so /retry re-announces the post', async () => {
    const { postId } = await seedProcessedPost(suite.orm.em);

    const publication = suite.factories.postPublication.makeOne({
      postId,
      platform: PublicationPlatform.Telegram,
      status: PublicationStatus.Failed,
      retryCount: 3,
      errorMessage: 'chat not found',
    });
    await suite.orm.em.flush();
    const publicationId = publication.id;
    suite.orm.em.clear();

    await suite.command(new RetryPostCommand(postId));
    suite.orm.em.clear();

    const reloaded = await suite.orm.em.findOneOrFail(
      PostPublication,
      publicationId,
    );
    expect(reloaded.status).toBe(PublicationStatus.Pending);
    expect(reloaded.retryCount).toBe(0);
    expect(reloaded.errorMessage).toBeNull();
  });

  it('leaves an already-published telegram publication untouched on retry', async () => {
    const { postId } = await seedProcessedPost(suite.orm.em);

    const publication = suite.factories.postPublication.makeOne({
      postId,
      platform: PublicationPlatform.Telegram,
      status: PublicationStatus.Published,
      externalId: '999',
    });
    await suite.orm.em.flush();
    const publicationId = publication.id;
    suite.orm.em.clear();

    await suite.command(new RetryPostCommand(postId));
    suite.orm.em.clear();

    const reloaded = await suite.orm.em.findOneOrFail(
      PostPublication,
      publicationId,
    );
    expect(reloaded.status).toBe(PublicationStatus.Published);
  });

  it('throws when the post does not exist', async () => {
    await expect(
      suite.command(
        new RetryPostCommand('01920000-0000-7000-8000-000000000000'),
      ),
    ).rejects.toThrow();
  });
});
