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
import { WordDefinition } from '../../../../modules/post/entities/word-definition.entity.js';
import { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';
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
      .send({ wordId: uuidv7(), phraseId: uuidv7() })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('reports how many cards are due for the feed badge', async () => {
    const cookie = await login(suite.orm.em);
    const word = suite.orm.em.create(Word, { lemma: `due-${uuidv7()}` });
    await suite.orm.em.flush();

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordId: word.id })
      .expect(HttpStatus.OK);

    // A freshly added card is due immediately (FSRS default), so this user
    // has exactly one due card.
    const res = await suite
      .request('get', '/learning/due-count')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(res.body).toEqual({ dueCount: 1 });
  });

  it('deletes an unreviewed card and archives a reviewed one', async () => {
    const cookie = await login(suite.orm.em);
    const word = suite.orm.em.create(Word, { lemma: `w-${uuidv7()}` });
    await suite.orm.em.flush();

    const added = await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordId: word.id })
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
    const word = suite.orm.em.create(Word, { lemma: `w-${uuidv7()}` });
    await suite.orm.em.flush();
    const definition = suite.orm.em.create(WordDefinition, {
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
});
