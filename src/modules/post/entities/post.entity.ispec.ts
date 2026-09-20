import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { PostSourceFormat } from '../enums/post-source-format.enum.js';
import { PostStatus } from '../enums/post-status.enum.js';
import { Exercise } from './exercise.entity.js';
import { Post } from './post.entity.js';
import { PostPart } from './post-part.entity.js';
import { PostPipelineRun } from './post-pipeline-run.entity.js';
import { PostPublication } from './post-publication.entity.js';
import { PostRead } from './post-read.entity.js';
import { Sentence } from './sentence.entity.js';
import { SentenceToken } from './sentence-token.entity.js';

describe('Post entity', () => {
  const suite = createIntegrationSuite();

  it('round-trips the embedded source and enum-backed status through Postgres', async () => {
    const post = suite.factories.post.makeOne({
      source: {
        format: PostSourceFormat.Text,
        rawText: 'The government announced negotiate.',
        link: 'https://example.com/article',
      },
      status: PostStatus.Pending,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const found = await suite.orm.em.findOneOrFail(Post, post.id);

    expect(found.source.format).toBe(PostSourceFormat.Text);
    expect(found.source.rawText).toBe('The government announced negotiate.');
    expect(found.source.link).toBe('https://example.com/article');
    expect(found.status).toBe(PostStatus.Pending);
  });

  it('cascades a post delete through its whole aggregate', async () => {
    const em = suite.orm.em;
    const { factories } = suite;
    const post = factories.post.makeOne();
    const part = factories.postPart.makeOne({ postId: post.id });
    const sentence = factories.sentence.makeOne({
      postId: post.id,
      postPartId: part.id,
    });
    factories.sentenceToken.makeOne({ sentenceId: sentence.id });
    factories.exercise.makeOne({ postId: post.id });
    factories.postPipelineRun.makeOne({ postId: post.id });
    factories.postPublication.makeOne({ postId: post.id });
    const user = factories.user.makeOne();
    factories.postRead.makeOne({ userId: user.id, postId: post.id });
    await em.flush();

    await em.nativeDelete(Post, post.id);

    expect({
      parts: await em.count(PostPart),
      sentences: await em.count(Sentence),
      tokens: await em.count(SentenceToken),
      exercises: await em.count(Exercise),
      runs: await em.count(PostPipelineRun),
      publications: await em.count(PostPublication),
      reads: await em.count(PostRead),
    }).toEqual({
      parts: 0,
      sentences: 0,
      tokens: 0,
      exercises: 0,
      runs: 0,
      publications: 0,
      reads: 0,
    });
  });
});
