import type { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createWebE2ESuite } from '../../../../../test/http/web/setup/e2e-suite.helper.js';
import AuthConfig from '../../../../modules/auth/config/auth.config.js';
import {
  generateToken,
  hashSecret,
} from '../../../../modules/auth/crypto/token.helper.js';
import { AuthSession } from '../../../../modules/auth/entities/auth-session.entity.js';
import { User } from '../../../../modules/auth/entities/user.entity.js';
import { Word } from '../../../../modules/post/entities/word.entity.js';
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
    const user = em.create(User, { email: `u-${uuidv7()}@example.com` });
    const token = generateToken();
    em.create(AuthSession, {
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
    const word = suite.orm.em.create(Word, { lemma: `w-${uuidv7()}` });
    await suite.orm.em.flush();

    const added = await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordId: word.id })
      .expect(HttpStatus.CREATED);
    expect(added.body).toMatchObject({ state: 'new', reps: 0 });
    const cardId = added.body.id;

    const queue = await suite
      .request('get', '/learning/practice?limit=5')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0]).toMatchObject({
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

  it('rejects an invalid rating', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('post', `/learning/cards/${uuidv7()}/review`)
      .set('Cookie', cookie)
      .send({ rating: 'brilliant' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('rejects a body with two targets', async () => {
    const cookie = await login(suite.orm.em);
    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordId: uuidv7(), phraseId: uuidv7() })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
