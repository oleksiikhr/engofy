import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
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
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  post.status = PostStatus.Published;
  em.persist(post);

  const part = new PostPart();
  part.postId = post.id;
  part.blockIndex = 0;
  part.kind = PostPartKind.Paragraph;
  part.body = {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Some text.' }],
  };
  part.annotatedAt = DateTime.now();
  em.persist(part);

  const sentence = new Sentence();
  sentence.postId = post.id;
  sentence.postPartId = part.id;
  sentence.unitIndex = 0;
  sentence.position = 0;
  sentence.rawText = 'Some text.';
  sentence.charStart = 0;
  sentence.charEnd = 10;
  em.persist(sentence);

  const token = new SentenceToken();
  token.sentenceId = sentence.id;
  token.position = 0;
  token.text = 'Some';
  token.charStart = 0;
  token.charEnd = 4;
  token.lemma = 'some';
  token.pos = 'DET';
  token.tag = 'DT';
  token.dep = 'det';
  token.morph = {};
  em.persist(token);

  const match = new GrammarMatch();
  match.sentenceId = sentence.id;
  match.grammarUsagePointId = post.id; // any uuid — no FK
  match.tokenStart = 0;
  match.tokenEnd = 1;
  em.persist(match);

  const exercise = new Exercise();
  exercise.postId = post.id;
  exercise.type = ExerciseType.Comprehension;
  exercise.source = ExerciseSource.Ai;
  exercise.payload = {};
  em.persist(exercise);

  for (const [stage, status] of [
    [PostPipelineStage.SpacyParse, PostPipelineRunStatus.Completed],
    [PostPipelineStage.AiGrammar, PostPipelineRunStatus.Failed],
  ] as const) {
    const run = new PostPipelineRun();
    run.postId = post.id;
    run.stage = stage;
    run.status = status;
    run.completedAt = DateTime.now();
    em.persist(run);
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

  it('is a no-op-safe reset when the post has no artefacts yet', async () => {
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'x';
    const post = new Post();
    post.source = source;
    post.status = PostStatus.Failed;
    suite.orm.em.persist(post);
    await suite.orm.em.flush();

    await suite.command(new RetryPostCommand(post.id));

    const reloaded = await suite.orm.em.findOneOrFail(Post, post.id);
    expect(reloaded.status).toBe(PostStatus.Pending);
    queue.assertSent<{ postId: string }>(
      QueueName.PostSpacyParse,
      (d) => d.postId === post.id,
    );
  });

  it('resets a failed telegram publication so /retry re-announces the post', async () => {
    const { postId } = await seedProcessedPost(suite.orm.em);

    const publication = new PostPublication();
    publication.postId = postId;
    publication.platform = PublicationPlatform.Telegram;
    publication.status = PublicationStatus.Failed;
    publication.retryCount = 3;
    publication.errorMessage = 'chat not found';
    suite.orm.em.persist(publication);
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

    const publication = new PostPublication();
    publication.postId = postId;
    publication.platform = PublicationPlatform.Telegram;
    publication.status = PublicationStatus.Published;
    publication.externalId = '999';
    suite.orm.em.persist(publication);
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
