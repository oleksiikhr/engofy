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
import { LearningWebModule } from '../../learning/learning-web.module.js';
import { DictionaryWebModule } from '../dictionary-web.module.js';

describe('DictionaryController words/:lemma', () => {
  const suite = createWebE2ESuite({
    imports: [DictionaryWebModule, LearningWebModule, AuthWebModule],
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
      .request('get', '/dictionary/words/go')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('404s for an unknown lemma', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);
    await suite
      .request('get', `/dictionary/words/nope-${uuidv7()}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns every sense and irregular-verb forms for a known lemma', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);
    const word = em.create(Word, { lemma: `Go-${uuidv7().slice(0, 6)}` });
    em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Verb,
      definition: 'to move from one place to another',
    });
    await em.flush();

    const res = await suite
      .request('get', `/dictionary/words/${word.lemma.toUpperCase()}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body.lemma).toBe(word.lemma);
    expect(res.body.senses).toHaveLength(1);
    expect(res.body.senses[0]).toMatchObject({
      pos: 'verb',
      state: 'new',
      cardId: null,
      definition: 'to move from one place to another',
    });
    expect(res.body.posts).toEqual([]);
  });

  it('surfaces the active card id for a saved sense', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);
    const word = em.create(Word, {
      lemma: `perambulate-${uuidv7().slice(0, 6)}`,
    });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Verb,
    });
    await em.flush();

    const addRes = await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id })
      .expect(HttpStatus.OK);

    const res = await suite
      .request('get', `/dictionary/words/${word.lemma}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body.senses[0]).toMatchObject({
      state: 'learning',
      cardId: addRes.body.id,
    });
  });
});
