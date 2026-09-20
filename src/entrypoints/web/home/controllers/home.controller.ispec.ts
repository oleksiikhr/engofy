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
import { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';
import { LearningModule } from '../../../../modules/learning/learning.module.js';
import { Post } from '../../../../modules/post/entities/post.entity.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { HomeWebModule } from '../home-web.module.js';

describe('HomeController', () => {
  const suite = createWebE2ESuite({
    imports: [HomeWebModule, AuthWebModule, LearningModule],
  });

  const cookieName = () =>
    suite.app.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY, {
      strict: false,
    }).sessionCookieName;

  async function login(
    em: EntityManager,
    cefrLevel: CefrLevel = CefrLevel.A1,
  ): Promise<string> {
    const user = factories(em).user.makeOne({
      email: `u-${uuidv7()}@example.com`,
      cefrLevel,
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
      .request('get', '/home/daily-plan')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('selects and then keeps returning the same daily plan', async () => {
    const cookie = await login(suite.orm.em);
    const post = await suite.factories.post.createOne({
      cefrLevel: CefrLevel.A1,
    });

    const first = await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(first.body).toMatchObject({
      postShortId: post.shortId,
      isRead: false,
      completedAt: null,
    });

    const second = await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(second.body).toEqual(first.body);
  });

  it("re-selects today's plan when its post was deleted", async () => {
    const cookie = await login(suite.orm.em);
    const deleted = await suite.factories.post.createOne({
      cefrLevel: CefrLevel.A1,
    });
    await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    await suite.orm.em.nativeDelete(Post, { id: deleted.id });
    const replacement = await suite.factories.post.createOne({
      cefrLevel: CefrLevel.A1,
    });

    const res = await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(res.body).toMatchObject({ postShortId: replacement.shortId });
  });

  it('rejects an unauthenticated cards request', async () => {
    await suite
      .request('get', '/home/daily-plan/cards')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('rejects a cards request before a daily plan has been selected', async () => {
    const cookie = await login(suite.orm.em);

    await suite
      .request('get', '/home/daily-plan/cards')
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns an empty due-cards page for a post with no matching cards', async () => {
    const cookie = await login(suite.orm.em);
    await suite.factories.post.createOne({ cefrLevel: CefrLevel.A1 });
    await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    const response = await suite
      .request('get', '/home/daily-plan/cards')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(response.body).toEqual({
      items: [],
      nextOffset: null,
      heldBackNewCount: 0,
      hasAnyCards: true,
    });
  });

  it('returns a due card whose target occurs in the day post', async () => {
    const em = suite.orm.em;
    const user = factories(em).user.makeOne({
      email: `u-${uuidv7()}@example.com`,
      cefrLevel: CefrLevel.A1,
    });
    const token = generateToken();
    factories(em).authSession.makeOne({
      userId: user.id,
      tokenHash: hashSecret(token),
      expiresAt: DateTime.now().plus({ days: 1 }),
    });
    const cookie = `${cookieName()}=${token}`;
    const post = await factories(em).post.createOne({
      cefrLevel: CefrLevel.A1,
    });

    const word = factories(em).word.makeOne({
      lemma: 'perambulate',
      frequencyRank: 1,
    });
    const wordDef = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Verb,
      definition: 'to walk around',
      cefrLevel: CefrLevel.A1,
    });
    const sentence = factories(em).sentence.makeOne({
      postId: post.id,
      postPartId: factories(em).postPart.makeOne({ postId: post.id }).id,
      unitIndex: 0,
      position: 0,
      rawText: 'She would perambulate the harbour.',
      charStart: 0,
      charEnd: 35,
    });
    factories(em).sentenceToken.makeOne({
      sentenceId: sentence.id,
      position: 0,
      text: 'perambulate',
      charStart: 10,
      charEnd: 21,
      lemma: 'perambulate',
      pos: 'VERB',
      tag: 'VB',
      dep: 'ROOT',
      morph: {},
      wordId: word.id,
      phraseId: null,
    });
    factories(em).learningCard.makeOne({
      userId: user.id,
      wordDefinitionId: wordDef.id,
      due: DateTime.now().minus({ hours: 1 }),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: LearningCardState.New,
    });
    await em.flush();

    await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    const response = await suite
      .request('get', '/home/daily-plan/cards')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      target: { type: 'word', primary: 'perambulate' },
    });
  });

  it('rejects an unauthenticated complete request', async () => {
    await suite
      .request('post', '/home/daily-plan/complete')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('completes the session and reports the day-zero summary', async () => {
    const cookie = await login(suite.orm.em);
    await suite.factories.post.createOne({ cefrLevel: CefrLevel.A1 });
    await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    const response = await suite
      .request('post', '/home/daily-plan/complete')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      newCardsToday: 0,
      reviewsToday: 0,
    });
    expect(response.body.completedAt).toEqual(expect.any(String));
  });

  it('rejects completing before a daily plan has been selected', async () => {
    const cookie = await login(suite.orm.em);

    await suite
      .request('post', '/home/daily-plan/complete')
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });
});
