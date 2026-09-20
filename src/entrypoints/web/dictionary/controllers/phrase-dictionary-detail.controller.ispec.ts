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
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { LearningWebModule } from '../../learning/learning-web.module.js';
import { DictionaryWebModule } from '../dictionary-web.module.js';

describe('DictionaryController phrases/:phrase', () => {
  const suite = createWebE2ESuite({
    imports: [DictionaryWebModule, LearningWebModule, AuthWebModule],
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
      .request('get', '/dictionary/phrases/at%20loose%20ends')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('404s for an unknown phrase', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);
    await suite
      .request(
        'get',
        `/dictionary/phrases/${encodeURIComponent(`nope ${uuidv7()}`)}`,
      )
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns the phrase with its state for a known phrase', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);
    const phrase = factories(em).phrase.makeOne({
      phraseText: `at loose ends ${uuidv7().slice(0, 6)}`,
      definition: 'having nothing particular to do',
      cefrLevel: CefrLevel.C1,
    });
    await em.flush();

    const res = await suite
      .request(
        'get',
        `/dictionary/phrases/${encodeURIComponent(phrase.phraseText.toUpperCase())}`,
      )
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body).toMatchObject({
      phraseId: phrase.id,
      phraseText: phrase.phraseText,
      definition: 'having nothing particular to do',
      state: 'new',
      cardId: null,
      posts: [],
    });
  });

  it('surfaces the active card id for a saved phrase', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);
    const phrase = factories(em).phrase.makeOne({
      phraseText: `break a leg ${uuidv7().slice(0, 6)}`,
      cefrLevel: CefrLevel.C1,
    });
    await em.flush();

    const addRes = await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ phraseId: phrase.id })
      .expect(HttpStatus.OK);

    const res = await suite
      .request(
        'get',
        `/dictionary/phrases/${encodeURIComponent(phrase.phraseText)}`,
      )
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body).toMatchObject({
      state: 'learning',
      cardId: addRes.body.id,
    });
  });
});
