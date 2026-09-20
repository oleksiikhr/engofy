import type { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { createWebE2ESuite } from '../../../../../test/http/web/setup/e2e-suite.helper.js';
import AuthConfig from '../../../../modules/auth/config/auth.config.js';
import {
  generateToken,
  hashSecret,
} from '../../../../modules/auth/crypto/token.helper.js';
import { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';
import { Post } from '../../../../modules/post/entities/post.entity.js';
import { PostRead } from '../../../../modules/post/entities/post-read.entity.js';
import { Word } from '../../../../modules/post/entities/word.entity.js';
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
  const word = factories(em).word.makeOne({
    lemma: `travel-${uuidv7().slice(0, 8)}`,
  });
  const definition = factories(em).wordDefinition.makeOne({
    wordId: word.id,
    pos: PartOfSpeech.Verb,
    definition: 'to go from one place to another',
    cefrLevel: CefrLevel.A2,
  });

  const source = {
    format: PostSourceFormat.Text,
    type: PostSourceType.NewsSnippet,
    rawText: 'She loves to travel widely.',
    link: 'https://example.com/article',
    attributionText: 'Example News, "On travel"',
  };

  const post = factories(em).post.makeOne({
    source,
    title: 'A Short Trip',
    slug: 'a-short-trip',
    status: PostStatus.Published,
    cefrLevel: CefrLevel.A2,
  });

  const part = factories(em).postPart.makeOne({
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

  const sentence = factories(em).sentence.makeOne({
    postId: post.id,
    postPartId: part.id,
    unitIndex: 0,
    position: 0,
    rawText: 'She loves to travel widely.',
    charStart: 0,
    charEnd: 27,
  });
  factories(em).exercise.makeOne({
    postId: post.id,
    type: ExerciseType.FillBlank,
    source: ExerciseSource.Spacy,
    payload: {
      sentenceId: sentence.id,
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
  const category = factories(em).grammarCategory.makeOne({
    name: `PRESENT-${uuidv7().slice(0, 8)}`,
    sortOrder: 1,
  });
  const construction = factories(em).grammarConstruction.makeOne({
    categoryId: category.id,
    name: 'present simple',
    slug,
    cheatSheetContent: '## Form\nSubject + base verb',
    sortOrder: 1,
  });
  const point = factories(em).grammarUsagePoint.makeOne({
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
    const user = factories(em).user.makeOne({
      email: `u-${uuidv7()}@example.com`,
    });
    const token = generateToken();
    factories(em).authSession.makeOne({
      userId: user.id,
      tokenHash: hashSecret(token),
      expiresAt: DateTime.now().plus({ days: 1 }),
    });
    await em.flush();
    return { cookie: `${cookieName()}=${token}`, userId: user.id };
  }

  it('sets Cache-Control + ETag on a content GET and 304s a matching revalidation', async () => {
    await seedPublishedPost(suite.orm.em);

    const first = await suite
      .request('get', '/content/posts/suggestions?q=trip')
      .expect(HttpStatus.OK);
    expect(first.headers['cache-control']).toBe('public');
    const etag = first.headers.etag as string;
    expect(etag.startsWith('"')).toBe(true);
    expect(etag.length).toBeGreaterThan(2);

    // A matching If-None-Match short-circuits to 304 with no body — proof the
    // ETag the interceptor issued is a real content hash, not a placeholder.
    await suite
      .request('get', '/content/posts/suggestions?q=trip')
      .set('If-None-Match', etag)
      .expect(HttpStatus.NOT_MODIFIED);
  });

  it('treats a blank ?limit= as the default, not a 400', async () => {
    await seedPublishedPost(suite.orm.em);

    const res = await suite
      .request('get', '/content/posts/suggestions?q=trip&limit=')
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
    const b2Source = {
      format: PostSourceFormat.Text,
      rawText: 'A harder read.',
    };
    const _b2Post = factories(em).post.makeOne({
      source: b2Source,
      title: 'A Harder Read',
      status: PostStatus.Published,
      cefrLevel: CefrLevel.B2,
    });
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
    const { id: postId } = await em.findOneOrFail(Post, { shortId });
    const sentence = factories(em).sentence.makeOne({
      postId,
      postPartId: factories(em).postPart.makeOne({ postId }).id,
      unitIndex: 0,
      position: 0,
      rawText: 'She loves to travel widely.',
      charStart: 0,
      charEnd: 27,
    });
    factories(em).sentenceToken.makeOne({
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
    expect(res.body.exercises[0].blockIndex).toBe(0);
    expect(res.body.sourceLink).toBe('https://example.com/article');
    expect(res.body.attributionText).toBe('Example News, "On travel"');
    expect(res.body.sourceType).toBe('news_snippet');

    // A guest gets every word/phrase state "new"; the sidebar is gone.
    expect(res.body.annotations.words[wordDefinitionId].state).toBe('new');
    expect(res.body.sidebar).toBeUndefined();
    expect(res.body.annotations.grammarMatches).toEqual([]);
    expect(res.body.annotations.tokens).toEqual([]);
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

  it('unmarks a post read for the logged-in user, idempotently, and reflects it in isRead', async () => {
    const { shortId, slug } = await seedPublishedPost(suite.orm.em);
    const { cookie } = await login(suite.orm.em);
    const path = `/content/posts/${slug}-${shortId}`;

    await suite
      .request('post', `${path}/read`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NO_CONTENT);
    const read = await suite
      .request('get', path)
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(read.body.isRead).toBe(true);

    await suite
      .request('delete', `${path}/read`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NO_CONTENT);
    // Unmarking a post that isn't read is a silent no-op.
    await suite
      .request('delete', `${path}/read`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NO_CONTENT);
    const unread = await suite
      .request('get', path)
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(unread.body.isRead).toBe(false);
  });

  it('401s unmarking a post read for a guest and 404s an unknown post', async () => {
    const { shortId, slug } = await seedPublishedPost(suite.orm.em);
    const { cookie } = await login(suite.orm.em);

    await suite
      .request('delete', `/content/posts/${slug}-${shortId}/read`)
      .expect(HttpStatus.UNAUTHORIZED);
    await suite
      .request('delete', '/content/posts/Zzz00000/read')
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('404s marking an unknown post read', async () => {
    const { cookie } = await login(suite.orm.em);

    await suite
      .request('post', '/content/posts/Zzz00000/read')
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('accepts a label report from a guest and 404s an unknown post', async () => {
    const { shortId, slug, wordDefinitionId } = await seedPublishedPost(
      suite.orm.em,
    );

    await suite
      .request('post', `/content/posts/${slug}-${shortId}/label-reports`)
      .send({ kind: 'word', targetId: wordDefinitionId })
      .expect(HttpStatus.NO_CONTENT);
    await suite
      .request('post', '/content/posts/Zzz00000/label-reports')
      .send({ kind: 'word', targetId: wordDefinitionId })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('rejects a label report with an unknown kind or a malformed target id', async () => {
    const { shortId, slug, wordDefinitionId } = await seedPublishedPost(
      suite.orm.em,
    );

    await suite
      .request('post', `/content/posts/${slug}-${shortId}/label-reports`)
      .send({ kind: 'sentence', targetId: wordDefinitionId })
      .expect(HttpStatus.BAD_REQUEST);
    await suite
      .request('post', `/content/posts/${slug}-${shortId}/label-reports`)
      .send({ kind: 'word', targetId: 'nope' })
      .expect(HttpStatus.BAD_REQUEST);
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
    const source = { format: PostSourceFormat.Text, rawText: 'draft' };
    const post = factories(em).post.makeOne({
      source,
      slug: 'draft',
      status: PostStatus.Processing,
    });
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
    const category = index.body.groups.find(
      (c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
    );
    expect(category).toBeTruthy();
    expect(
      category.constructions.find((c: { slug: string }) => c.slug === slug),
    ).toMatchObject({ cefrLevel: 'A1', usagePointCount: 1, state: 'new' });
    // A guest carries no progress counts.
    expect(
      category.constructions.find((c: { slug: string }) => c.slug === slug),
    ).not.toHaveProperty('learnedCount');

    const detail = await suite
      .request('get', `/content/grammar/${slug}`)
      .expect(HttpStatus.OK);
    expect(detail.body).toMatchObject({
      name: 'present simple',
      cefrLevel: 'A1',
    });
    expect(detail.body.usagePoints).toHaveLength(1);
    expect(detail.body.usagePoints[0]).toMatchObject({
      state: 'new',
      assumedKnown: false,
    });
    expect(detail.body).not.toHaveProperty('levelProgress');
    expect(detail.body.cheatSheetContent).toContain('Form');
  });

  it('filters the grammar reference by CEFR level', async () => {
    const { slug } = await seedGrammar(suite.orm.em);

    const kept = await suite.request('get', '/content/grammar?cefr=A1');
    expect(
      kept.body.groups.some((c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
      ),
    ).toBe(true);

    const dropped = await suite.request('get', '/content/grammar?cefr=C2');
    expect(
      dropped.body.groups.some((c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
      ),
    ).toBe(false);

    // Multi-select: any listed level keeps the construction.
    const multi = await suite.request('get', '/content/grammar?cefr=C2,A1');
    expect(
      multi.body.groups.some((g: { constructions: { slug: string }[] }) =>
        g.constructions.some((con) => con.slug === slug),
      ),
    ).toBe(true);
    await suite
      .request('get', '/content/grammar?cefr=A1,Z9')
      .expect(HttpStatus.BAD_REQUEST);

    // A blank ?cefr= must fall through to "no filter", not 400.
    await suite.request('get', '/content/grammar?cefr=').expect(HttpStatus.OK);
  });

  it('groups the grammar reference by the requested axis', async () => {
    const { slug } = await seedGrammar(suite.orm.em);
    const keysHolding = (body: {
      groups: { key: string; constructions: { slug: string }[] }[];
    }) =>
      body.groups
        .filter((g) => g.constructions.some((con) => con.slug === slug))
        .map((g) => g.key);

    const byCefr = await suite
      .request('get', '/content/grammar?groupBy=cefr')
      .expect(HttpStatus.OK);
    expect(keysHolding(byCefr.body)).toEqual(['A1']);

    const byTime = await suite
      .request('get', '/content/grammar?groupBy=time')
      .expect(HttpStatus.OK);
    expect(byTime.body.groups.map((g: { key: string }) => g.key)).toContain(
      'other',
    );

    // Default (and a blank value) stays category-grouped.
    const byDefault = await suite.request('get', '/content/grammar?groupBy=');
    const byCategory = await suite.request('get', '/content/grammar');
    expect(byDefault.body.groups).toEqual(byCategory.body.groups);

    await suite
      .request('get', '/content/grammar?groupBy=bogus')
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('personalizes grammar state for a logged-in learner and marks the response private', async () => {
    const { slug, grammarUsagePointId } = await seedGrammar(suite.orm.em);
    const { cookie, userId } = await login(suite.orm.em);
    suite.factories.learningCard.makeOne({
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
    const construction = index.body.groups
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
    await request(server)
      .get('/content/posts/suggestions?q=trip')
      .expect(HttpStatus.NOT_FOUND);
    await request(server)
      .get('/api/posts/suggestions?q=trip')
      .expect(HttpStatus.NOT_FOUND);
    await request(server)
      .get('/api/content/posts/suggestions?q=trip')
      .expect(HttpStatus.OK);
  });

  it('404s an unknown construction slug', async () => {
    await suite
      .request('get', '/content/grammar/no-such-slug')
      .expect(HttpStatus.NOT_FOUND);
  });
});
