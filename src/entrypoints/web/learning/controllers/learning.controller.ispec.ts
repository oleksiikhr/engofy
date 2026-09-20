import type { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { createWebE2ESuite } from '../../../../../test/http/web/setup/e2e-suite.helper.js';
import AuthConfig from '../../../../modules/auth/config/auth.config.js';
import {
  generateToken,
  hashSecret,
} from '../../../../modules/auth/crypto/token.helper.js';
import { DAILY_NEW_CARD_LIMIT } from '../../../../modules/learning/domain/daily-new-card-limit.js';
import { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';
import { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';
import { PostSourceFormat } from '../../../../modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../../modules/post/enums/post-status.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { LearningWebModule } from '../learning-web.module.js';

describe('LearningController', () => {
  const suite = createWebE2ESuite({
    imports: [LearningWebModule, AuthWebModule],
  });

  const cookieName = () =>
    suite.app.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY, {
      strict: false,
    }).sessionCookieName;

  async function login(em: EntityManager): Promise<string> {
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
    return `${cookieName()}=${token}`;
  }

  it('rejects an unauthenticated request', async () => {
    await suite
      .request('get', '/learning/practice')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('adds a card, lists it in the practice queue, and reviews it', async () => {
    const cookie = await login(suite.orm.em);
    const word = suite.factories.word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await suite.orm.em.flush();

    const added = await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id })
      .expect(HttpStatus.OK);
    expect(added.body).toMatchObject({ state: 'new', reps: 0 });
    const cardId = added.body.id;

    const queue = await suite
      .request('get', '/learning/practice?limit=5')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(queue.body.nextOffset).toBeNull();
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0]).toMatchObject({
      cardId,
      target: { type: 'word', primary: word.lemma },
    });

    const reviewed = await suite
      .request('post', `/learning/cards/${cardId}/review`)
      .set('Cookie', cookie)
      .send({ rating: 'good' })
      .expect(HttpStatus.OK);
    expect(reviewed.body.reps).toBe(1);
  });

  it('caps New cards at the daily limit and lifts it with bypassNewLimit', async () => {
    const em = suite.orm.em;
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
    const cookie = `${cookieName()}=${token}`;

    for (let i = 0; i < DAILY_NEW_CARD_LIMIT + 2; i += 1) {
      const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
      const definition = factories(em).wordDefinition.makeOne({
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
      factories(em).learningCard.makeOne({
        userId: user.id,
        wordDefinitionId: definition.id,
        due: DateTime.now().minus({ minutes: i + 1 }),
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: LearningCardState.New,
      });
    }
    await em.flush();
    em.clear();

    const capped = await suite
      .request('get', `/learning/practice?limit=${DAILY_NEW_CARD_LIMIT + 2}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(capped.body.items).toHaveLength(DAILY_NEW_CARD_LIMIT);
    expect(capped.body.heldBackNewCount).toBe(2);

    const bypassed = await suite
      .request(
        'get',
        `/learning/practice?limit=${DAILY_NEW_CARD_LIMIT + 2}&bypassNewLimit=true`,
      )
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(bypassed.body.items).toHaveLength(DAILY_NEW_CARD_LIMIT + 2);
    expect(bypassed.body.heldBackNewCount).toBe(0);
    expect(bypassed.body.hasAnyCards).toBe(true);

    const noPhrases = await suite
      .request('get', '/learning/practice?types=phrase,grammar')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(noPhrases.body).toMatchObject({ items: [], hasAnyCards: true });

    await suite
      .request('get', '/learning/practice?types=bogus')
      .set('Cookie', cookie)
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('rejects an invalid rating', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('post', `/learning/cards/${uuidv7()}/review`)
      .set('Cookie', cookie)
      .send({ rating: 'brilliant' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('returns 404 when reviewing a card that does not exist', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('post', `/learning/cards/${uuidv7()}/review`)
      .set('Cookie', cookie)
      .send({ rating: 'good' })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('rejects a body with two targets', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: uuidv7(), phraseId: uuidv7() })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('reports how many cards are due for the feed badge', async () => {
    const cookie = await login(suite.orm.em);
    const word = suite.factories.word.makeOne({ lemma: `due-${uuidv7()}` });
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await suite.orm.em.flush();

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id })
      .expect(HttpStatus.OK);

    // A freshly added card is due immediately (FSRS default), so this user
    // has exactly one due card.
    const res = await suite
      .request('get', '/learning/due-count')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(res.body).toEqual({ dueCount: 1 });
  });

  it('reports the full daily new-card budget for a user with no reviews, and rejects a guest', async () => {
    await suite
      .request('get', '/learning/new-card-budget')
      .expect(HttpStatus.UNAUTHORIZED);

    const cookie = await login(suite.orm.em);
    const res = await suite
      .request('get', '/learning/new-card-budget')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(res.body).toEqual({ remaining: DAILY_NEW_CARD_LIMIT });
  });

  it('reports the streak and daily-goal progress, and rejects a guest', async () => {
    await suite
      .request('get', '/learning/streak')
      .expect(HttpStatus.UNAUTHORIZED);

    const cookie = await login(suite.orm.em);
    const empty = await suite
      .request('get', '/learning/streak')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(empty.body).toEqual({ streak: 0, dailyGoal: 10, reviewedToday: 0 });

    const word = suite.factories.word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await suite.orm.em.flush();
    const added = await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id })
      .expect(HttpStatus.OK);
    await suite
      .request('post', `/learning/cards/${added.body.id}/review`)
      .set('Cookie', cookie)
      .send({ rating: 'good' })
      .expect(HttpStatus.OK);

    const after = await suite
      .request('get', '/learning/streak')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(after.body).toEqual({ streak: 1, dailyGoal: 10, reviewedToday: 1 });
  });

  it('deletes an unreviewed card and archives a reviewed one', async () => {
    const cookie = await login(suite.orm.em);
    const word = suite.factories.word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await suite.orm.em.flush();

    const added = await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id })
      .expect(HttpStatus.OK);

    await suite
      .request('delete', `/learning/cards/${added.body.id}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NO_CONTENT);

    await suite
      .request('post', `/learning/cards/${added.body.id}/review`)
      .set('Cookie', cookie)
      .send({ rating: 'good' })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns 404 when removing a card that does not exist', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('delete', `/learning/cards/${uuidv7()}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('sets and overwrites a disposition for a word definition target', async () => {
    const cookie = await login(suite.orm.em);
    const word = suite.factories.word.makeOne({ lemma: `w-${uuidv7()}` });
    await suite.orm.em.flush();
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await suite.orm.em.flush();

    const first = await suite
      .request('post', '/learning/dispositions')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id, disposition: 'skipped' })
      .expect(HttpStatus.OK);
    expect(first.body.disposition).toBe('skipped');

    const second = await suite
      .request('post', '/learning/dispositions')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id, disposition: 'known' })
      .expect(HttpStatus.OK);
    expect(second.body.disposition).toBe('known');
    expect(second.body.id).toBe(first.body.id);
  });

  it('rejects a disposition body with no target', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('post', '/learning/dispositions')
      .set('Cookie', cookie)
      .send({ disposition: 'known' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('lists only the due cards whose target occurs in the given post', async () => {
    const cookie = await login(suite.orm.em);
    const em = suite.orm.em;
    const source = { format: PostSourceFormat.Text, rawText: 'seed' };
    const post = factories(em).post.makeOne({
      source,
      title: 'due cards post',
      status: PostStatus.Published,
    });

    const inPost = factories(em).word.makeOne({ lemma: `in-${uuidv7()}` });
    const inPostDefinition = factories(em).wordDefinition.makeOne({
      wordId: inPost.id,
      pos: PartOfSpeech.Noun,
    });
    const elsewhere = factories(em).word.makeOne({ lemma: `out-${uuidv7()}` });
    const elsewhereDefinition = factories(em).wordDefinition.makeOne({
      wordId: elsewhere.id,
      pos: PartOfSpeech.Noun,
    });
    const sentence = factories(em).sentence.makeOne({
      postId: post.id,
      postPartId: factories(em).postPart.makeOne({ postId: post.id }).id,
      unitIndex: 0,
      position: 0,
      rawText: 'a term',
      charStart: 0,
      charEnd: 6,
    });
    factories(em).sentenceToken.makeOne({
      sentenceId: sentence.id,
      position: 0,
      text: 'term',
      charStart: 2,
      charEnd: 6,
      lemma: inPost.lemma,
      pos: 'NOUN',
      tag: 'NN',
      dep: 'nsubj',
      morph: {},
      wordId: inPost.id,
      phraseId: null,
    });
    await em.flush();

    await Promise.all(
      [inPostDefinition, elsewhereDefinition].map((definition) =>
        suite
          .request('post', '/learning/cards')
          .set('Cookie', cookie)
          .send({ wordDefinitionId: definition.id })
          .expect(HttpStatus.OK),
      ),
    );

    const res = await suite
      .request(
        'get',
        `/learning/posts/due-cards-post-${post.shortId}/due-cards`,
      )
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].target.id).toBe(inPostDefinition.id);
  });

  it('returns 404 for the due cards of an unknown post', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('get', '/learning/posts/nope-Zz9Zz9Zz/due-cards')
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('rejects an unauthenticated post due-cards request', async () => {
    await suite
      .request('get', '/learning/posts/some-post-Zz9Zz9Zz/due-cards')
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
