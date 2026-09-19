import type { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { createWebE2ESuite } from '../../../../../test/http/web/setup/e2e-suite.helper.js';
import AuthConfig from '../../../../modules/auth/config/auth.config.js';
import {
  generateToken,
  hashSecret,
} from '../../../../modules/auth/crypto/token.helper.js';
import { AuthSession } from '../../../../modules/auth/entities/auth-session.entity.js';
import { User } from '../../../../modules/auth/entities/user.entity.js';
import { LearningCard } from '../../../../modules/learning/entities/learning-card.entity.js';
import { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';
import { PostSource } from '../../../../modules/post/embeddables/post-source.embeddable.js';
import { Exercise } from '../../../../modules/post/entities/exercise.entity.js';
import { GrammarCategory } from '../../../../modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../../modules/post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../../modules/post/entities/grammar-usage-point.entity.js';
import { Post } from '../../../../modules/post/entities/post.entity.js';
import { PostPart } from '../../../../modules/post/entities/post-part.entity.js';
import { PostRead } from '../../../../modules/post/entities/post-read.entity.js';
import { Sentence } from '../../../../modules/post/entities/sentence.entity.js';
import { SentenceToken } from '../../../../modules/post/entities/sentence-token.entity.js';
import { Word } from '../../../../modules/post/entities/word.entity.js';
import { WordDefinition } from '../../../../modules/post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { ExerciseSource } from '../../../../modules/post/enums/exercise-source.enum.js';
import { ExerciseType } from '../../../../modules/post/enums/exercise-type.enum.js';
import { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';
import { PostPartKind } from '../../../../modules/post/enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../../../modules/post/enums/post-source-format.enum.js';
import { PostSourceType } from '../../../../modules/post/enums/post-source-type.enum.js';
import { PostStatus } from '../../../../modules/post/enums/post-status.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { ContentWebModule } from '../content-web.module.js';

interface SeededPost {
  shortId: string;
  slug: string;
  wordDefinitionId: string;
}

async function seedPublishedPost(em: EntityManager): Promise<SeededPost> {
  const word = em.create(Word, { lemma: `travel-${uuidv7().slice(0, 8)}` });
  const definition = em.create(WordDefinition, {
    wordId: word.id,
    pos: PartOfSpeech.Verb,
    definition: 'to go from one place to another',
    cefrLevel: CefrLevel.A2,
  });

  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.type = PostSourceType.NewsSnippet;
  source.rawText = 'She loves to travel widely.';
  source.link = 'https://example.com/article';
  source.attributionText = 'Example News, "On travel"';

  const post = new Post();
  post.source = source;
  post.title = 'A Short Trip';
  post.slug = 'a-short-trip';
  post.status = PostStatus.Published;
  post.cefrLevel = CefrLevel.A2;
  em.persist(post);

  em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'She loves to ' },
        {
          type: 'span',
          kind: 'word',
          text: 'travel',
          wordDefinitionId: definition.id,
          pos: 'VERB',
        },
        { type: 'text', text: ' widely.' },
      ],
    },
  });

  em.create(Exercise, {
    postId: post.id,
    type: ExerciseType.FillBlank,
    source: ExerciseSource.Spacy,
    payload: {
      sentenceId: uuidv7(),
      prompt: 'She loves to ____ widely.',
      answer: 'travel',
    },
  });

  await em.flush();
  return {
    shortId: post.shortId,
    slug: 'a-short-trip',
    wordDefinitionId: definition.id,
  };
}

interface SeededGrammar {
  slug: string;
  grammarUsagePointId: string;
}

async function seedGrammar(em: EntityManager): Promise<SeededGrammar> {
  const slug = `present-simple-${uuidv7().slice(0, 8)}`;
  const category = em.create(GrammarCategory, {
    name: `PRESENT-${uuidv7().slice(0, 8)}`,
    sortOrder: 1,
  });
  const construction = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'present simple',
    slug,
    cheatSheetContent: '## Form\nSubject + base verb',
    sortOrder: 1,
  });
  const point = em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    cefrLevel: CefrLevel.A1,
    guideword: 'USE: HABITS AND GENERAL FACTS',
    canDoStatement: 'Can describe routines.',
    exampleText: 'I get up at seven.',
  });
  await em.flush();
  return { slug, grammarUsagePointId: point.id };
}

describe('ContentController', () => {
  const suite = createWebE2ESuite({
    imports: [ContentWebModule, AuthWebModule],
  });

  const cookieName = () =>
    suite.app.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY, {
      strict: false,
    }).sessionCookieName;

  async function login(
    em: EntityManager,
  ): Promise<{ cookie: string; userId: string }> {
    const user = em.create(User, { email: `u-${uuidv7()}@example.com` });
    const token = generateToken();
    em.create(AuthSession, {
      userId: user.id,
      tokenHash: hashSecret(token),
      expiresAt: DateTime.now().plus({ days: 1 }),
    });
    await em.flush();
    return { cookie: `${cookieName()}=${token}`, userId: user.id };
  }

  it('lists a published post in the feed with an excerpt', async () => {
    const { shortId } = await seedPublishedPost(suite.orm.em);

    const res = await suite
      .request('get', '/content/feed')
      .expect(HttpStatus.OK);

    const item = res.body.items.find(
      (entry: { shortId: string }) => entry.shortId === shortId,
    );
    expect(item).toMatchObject({
      title: 'A Short Trip',
      cefrLevel: 'A2',
      attributionText: 'Example News, "On travel"',
      sourceType: 'news_snippet',
      sourceLink: 'https://example.com/article',
    });
    expect(item.excerpt).toContain('travel');
    expect(res.body.nextOffset).toBeNull();
  });

  it('sets Cache-Control + ETag on a content GET and 304s a matching revalidation', async () => {
    await seedPublishedPost(suite.orm.em);

    const first = await suite
      .request('get', '/content/feed')
      .expect(HttpStatus.OK);
    expect(first.headers['cache-control']).toBe('public');
    const etag = first.headers.etag as string;
    expect(etag.startsWith('"')).toBe(true);
    expect(etag.length).toBeGreaterThan(2);

    // A matching If-None-Match short-circuits to 304 with no body — proof the
    // ETag the interceptor issued is a real content hash, not a placeholder.
    await suite
      .request('get', '/content/feed')
      .set('If-None-Match', etag)
      .expect(HttpStatus.NOT_MODIFIED);
  });

  it('treats a blank ?limit= / ?offset= as the default, not a 400', async () => {
    await seedPublishedPost(suite.orm.em);

    const res = await suite
      .request('get', '/content/feed?limit=&offset=')
      .expect(HttpStatus.OK);

    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('lists a published post in the posts archive with an excerpt', async () => {
    const { shortId } = await seedPublishedPost(suite.orm.em);

    const res = await suite
      .request('get', '/content/posts')
      .expect(HttpStatus.OK);

    const item = res.body.items.find(
      (entry: { shortId: string }) => entry.shortId === shortId,
    );
    expect(item).toMatchObject({
      title: 'A Short Trip',
      cefrLevel: 'A2',
      attributionText: 'Example News, "On travel"',
      sourceType: 'news_snippet',
      sourceLink: 'https://example.com/article',
    });
    expect(item.excerpt).toContain('travel');
    expect(res.body.nextCursor).toBeNull();
  });

  it('filters the posts archive by a CEFR multi-select', async () => {
    const em = suite.orm.em;
    await seedPublishedPost(em);
    const b2Source = new PostSource();
    b2Source.format = PostSourceFormat.Text;
    b2Source.rawText = 'A harder read.';
    const b2Post = new Post();
    b2Post.source = b2Source;
    b2Post.title = 'A Harder Read';
    b2Post.status = PostStatus.Published;
    b2Post.cefrLevel = CefrLevel.B2;
    em.persist(b2Post);
    await em.flush();

    const kept = await suite
      .request('get', '/content/posts?cefr=A2,B2')
      .expect(HttpStatus.OK);
    expect(kept.body.items).toHaveLength(2);

    const filtered = await suite
      .request('get', '/content/posts?cefr=B2')
      .expect(HttpStatus.OK);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].title).toBe('A Harder Read');

    // A blank ?cefr= must fall through to "no filter", not 400.
    await suite.request('get', '/content/posts?cefr=').expect(HttpStatus.OK);
  });

  it('filters the posts archive by a word term and suggests it by prefix', async () => {
    const em = suite.orm.em;
    const { shortId } = await seedPublishedPost(em);
    const word = await em.findOneOrFail(Word, {
      lemma: { $like: 'travel-%' },
    });
    const sentence = em.create(Sentence, {
      postId: (await em.findOneOrFail(Post, { shortId })).id,
      postPartId: uuidv7(),
      unitIndex: 0,
      position: 0,
      rawText: 'She loves to travel widely.',
      charStart: 0,
      charEnd: 27,
    });
    em.create(SentenceToken, {
      sentenceId: sentence.id,
      position: 3,
      text: 'travel',
      charStart: 13,
      charEnd: 19,
      lemma: 'travel',
      pos: 'VERB',
      tag: 'VB',
      dep: 'xcomp',
      morph: {},
      wordId: word.id,
    });
    await em.flush();

    const hit = await suite
      .request('get', `/content/posts?term=${word.lemma.toUpperCase()}`)
      .expect(HttpStatus.OK);
    expect(hit.body.items.map((i: { shortId: string }) => i.shortId)).toEqual([
      shortId,
    ]);
    const miss = await suite
      .request('get', '/content/posts?term=nothing-like-this')
      .expect(HttpStatus.OK);
    expect(miss.body.items).toEqual([]);

    const suggestions = await suite
      .request('get', `/content/posts/suggestions?q=${word.lemma.slice(0, 9)}`)
      .expect(HttpStatus.OK);
    expect(suggestions.body.items).toContainEqual({
      type: 'word',
      text: word.lemma,
    });

    await suite
      .request('get', '/content/posts/suggestions')
      .expect(HttpStatus.BAD_REQUEST);
    await suite
      .request('get', '/content/posts/suggestions?q=')
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('excludes an already-read post only when unreadOnly is set for a logged-in user', async () => {
    const em = suite.orm.em;
    const { shortId, slug } = await seedPublishedPost(em);
    const { cookie } = await login(em);

    await suite
      .request('post', `/content/posts/${slug}-${shortId}/read`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NO_CONTENT);

    const guestUnreadOnly = await suite
      .request('get', '/content/posts?unreadOnly=true')
      .expect(HttpStatus.OK);
    expect(
      guestUnreadOnly.body.items.some(
        (i: { shortId: string }) => i.shortId === shortId,
      ),
    ).toBe(true);

    const loggedInUnreadOnly = await suite
      .request('get', '/content/posts?unreadOnly=true')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(
      loggedInUnreadOnly.body.items.some(
        (i: { shortId: string }) => i.shortId === shortId,
      ),
    ).toBe(false);
  });

  it('rejects a garbage posts-archive cursor with 400', async () => {
    await suite
      .request('get', '/content/posts?cursor=not-a-real-cursor')
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('normalises a 404 body to { message }', async () => {
    const res = await suite
      .request('get', '/content/posts/Zzz00000')
      .expect(HttpStatus.NOT_FOUND);

    expect(res.body).toEqual({ message: 'Post not found' });
  });

  it('returns a post with its node tree, resolved annotations and exercises', async () => {
    const { shortId, slug, wordDefinitionId } = await seedPublishedPost(
      suite.orm.em,
    );

    const res = await suite
      .request('get', `/content/posts/${slug}-${shortId}`)
      .expect(HttpStatus.OK);

    expect(res.body.doc.type).toBe('doc');
    expect(res.body.annotations.words[wordDefinitionId]).toMatchObject({
      pos: 'verb',
      definition: 'to go from one place to another',
      cefrLevel: 'A2',
    });
    expect(res.body.exercises).toHaveLength(1);
    expect(res.body.sourceLink).toBe('https://example.com/article');
    expect(res.body.attributionText).toBe('Example News, "On travel"');
    expect(res.body.sourceType).toBe('news_snippet');

    // Sidebar (PLAN.md §17 Track B) — a guest gets every entry state "new".
    expect(res.body.sidebar.words).toEqual([
      expect.objectContaining({ wordDefinitionId, state: 'new' }),
    ]);
  });

  it('marks the post-detail response Cache-Control: private (it varies per session, unlike the other content routes)', async () => {
    const { shortId, slug } = await seedPublishedPost(suite.orm.em);

    const res = await suite
      .request('get', `/content/posts/${slug}-${shortId}`)
      .expect(HttpStatus.OK);

    expect(res.headers['cache-control']).toBe('private');
  });

  it('rejects an unauthenticated mark-read request', async () => {
    const { shortId, slug } = await seedPublishedPost(suite.orm.em);

    await suite
      .request('post', `/content/posts/${slug}-${shortId}/read`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('marks a post read for the logged-in user, idempotently', async () => {
    const { shortId, slug } = await seedPublishedPost(suite.orm.em);
    const { cookie } = await login(suite.orm.em);

    await suite
      .request('post', `/content/posts/${slug}-${shortId}/read`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NO_CONTENT);
    // A second submit (re-taking the quiz) is a silent no-op.
    await suite
      .request('post', `/content/posts/${slug}-${shortId}/read`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NO_CONTENT);

    const post = await suite.orm.em.findOneOrFail(Post, { shortId });
    expect(await suite.orm.em.count(PostRead, { postId: post.id })).toBe(1);
  });

  it('404s marking an unknown post read', async () => {
    const { cookie } = await login(suite.orm.em);

    await suite
      .request('post', '/content/posts/Zzz00000/read')
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('accepts a bare short id and 404s an unknown post', async () => {
    const { shortId } = await seedPublishedPost(suite.orm.em);

    await suite
      .request('get', `/content/posts/${shortId}`)
      .expect(HttpStatus.OK);
    await suite
      .request('get', '/content/posts/a-day-with-no-id')
      .expect(HttpStatus.NOT_FOUND);
    await suite
      .request('get', '/content/posts/Zzz00000')
      .expect(HttpStatus.NOT_FOUND);
  });

  it('does not expose a non-published post', async () => {
    const em = suite.orm.em;
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'draft';
    const post = new Post();
    post.source = source;
    post.slug = 'draft';
    post.status = PostStatus.Processing;
    em.persist(post);
    await em.flush();

    await suite
      .request('get', `/content/posts/draft-${post.shortId}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('serves the grammar reference and a single construction', async () => {
    const { slug } = await seedGrammar(suite.orm.em);

    const index = await suite
      .request('get', '/content/grammar')
      .expect(HttpStatus.OK);
    const category = index.body.categories.find(
      (c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
    );
    expect(category).toBeTruthy();
    expect(
      category.constructions.find((c: { slug: string }) => c.slug === slug),
    ).toMatchObject({ cefrLevel: 'A1', usagePointCount: 1, state: 'new' });

    const detail = await suite
      .request('get', `/content/grammar/${slug}`)
      .expect(HttpStatus.OK);
    expect(detail.body).toMatchObject({
      name: 'present simple',
      cefrLevel: 'A1',
    });
    expect(detail.body.usagePoints).toHaveLength(1);
    expect(detail.body.usagePoints[0]).toMatchObject({ state: 'new' });
    expect(detail.body.cheatSheetContent).toContain('Form');
  });

  it('filters the grammar reference by CEFR level', async () => {
    const { slug } = await seedGrammar(suite.orm.em);

    const kept = await suite.request('get', '/content/grammar?cefr=A1');
    expect(
      kept.body.categories.some((c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
      ),
    ).toBe(true);

    const dropped = await suite.request('get', '/content/grammar?cefr=C2');
    expect(
      dropped.body.categories.some((c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
      ),
    ).toBe(false);

    // A blank ?cefr= must fall through to "no filter", not 400.
    await suite.request('get', '/content/grammar?cefr=').expect(HttpStatus.OK);
  });

  it('personalizes grammar state for a logged-in learner and marks the response private', async () => {
    const { slug, grammarUsagePointId } = await seedGrammar(suite.orm.em);
    const { cookie, userId } = await login(suite.orm.em);
    suite.orm.em.create(LearningCard, {
      userId,
      grammarUsagePointId,
      due: DateTime.now(),
      stability: 1,
      difficulty: 1,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: LearningCardState.Learning,
    });
    await suite.orm.em.flush();

    const index = await suite
      .request('get', '/content/grammar')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(index.headers['cache-control']).toBe('private');
    const construction = index.body.categories
      .flatMap((c: { constructions: { slug: string }[] }) => c.constructions)
      .find((c: { slug: string }) => c.slug === slug);
    expect(construction).toMatchObject({ state: 'learning' });

    const detail = await suite
      .request('get', `/content/grammar/${slug}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(detail.headers['cache-control']).toBe('private');
    expect(detail.body.usagePoints[0]).toMatchObject({ state: 'learning' });
  });

  it('serves under the /api/content prefix and not at the root', async () => {
    const server = suite.app.getHttpServer();
    await request(server).get('/feed').expect(HttpStatus.NOT_FOUND);
    await request(server).get('/content/feed').expect(HttpStatus.NOT_FOUND);
    await request(server).get('/api/feed').expect(HttpStatus.NOT_FOUND);
    await request(server).get('/api/content/feed').expect(HttpStatus.OK);
  });

  it('404s an unknown construction slug', async () => {
    await suite
      .request('get', '/content/grammar/no-such-slug')
      .expect(HttpStatus.NOT_FOUND);
  });
});
