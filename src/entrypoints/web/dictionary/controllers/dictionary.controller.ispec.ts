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
import { Disposition } from '../../../../modules/learning/enums/disposition.enum.js';
import { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';
import { PostSourceFormat } from '../../../../modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../../modules/post/enums/post-status.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { LearningWebModule } from '../../learning/learning-web.module.js';
import { DictionaryWebModule } from '../dictionary-web.module.js';

describe('DictionaryController', () => {
  const suite = createWebE2ESuite({
    imports: [DictionaryWebModule, LearningWebModule, AuthWebModule],
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

  it('rejects an unauthenticated request', async () => {
    await suite.request('get', '/dictionary').expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns word entries with status and the posts they appear in', async () => {
    const em = suite.orm.em;
    const { cookie } = await login(em);

    const word = factories(em).word.makeOne({
      lemma: `harbour-${uuidv7().slice(0, 8)}`,
    });
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'a sheltered stretch of water',
    });
    const source = {
      format: PostSourceFormat.Text,
      rawText: 'The harbour was calm.',
    };
    const post = factories(em).post.makeOne({
      source,
      title: 'Down by the Water',
      slug: 'down-by-the-water',
      status: PostStatus.Published,
    });
    const sentence = factories(em).sentence.makeOne({
      postId: post.id,
      postPartId: uuidv7(),
      unitIndex: 0,
      position: 0,
      rawText: 'The harbour was calm.',
      charStart: 0,
      charEnd: 21,
    });
    factories(em).sentenceToken.makeOne({
      sentenceId: sentence.id,
      position: 1,
      text: 'harbour',
      charStart: 4,
      charEnd: 11,
      lemma: 'harbour',
      pos: 'NOUN',
      tag: 'NN',
      dep: 'nsubj',
      morph: {},
      wordId: word.id,
    });
    await em.flush();

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id })
      .expect(HttpStatus.OK);

    const res = await suite
      .request('get', '/dictionary')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      type: 'word',
      state: 'learning',
      senseCount: 1,
      primary: word.lemma,
      secondary: 'noun',
      definition: 'a sheltered stretch of water',
    });
    expect(res.body.items[0].posts).toEqual([
      {
        shortId: post.shortId,
        slug: 'down-by-the-water',
        title: 'Down by the Water',
      },
    ]);
  });

  it('includes phrase entries and a disposition-only entry with no card', async () => {
    const em = suite.orm.em;
    const { cookie, userId } = await login(em);

    const phrase = factories(em).phrase.makeOne({
      phraseText: `pick up-${uuidv7().slice(0, 8)}`,
      definition: 'to collect someone',
    });
    const knownPhrase = factories(em).phrase.makeOne({
      phraseText: `break a leg-${uuidv7().slice(0, 8)}`,
    });
    await em.flush();
    factories(em).learningDisposition.makeOne({
      userId,
      phraseId: knownPhrase.id,
      disposition: Disposition.Known,
    });

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ phraseId: phrase.id })
      .expect(HttpStatus.OK);
    await em.flush();

    const res = await suite
      .request('get', '/dictionary')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'phrase',
          state: 'learning',
          primary: phrase.phraseText,
          posts: [],
        }),
        expect.objectContaining({
          type: 'phrase',
          state: 'learned',
          primary: knownPhrase.phraseText,
        }),
      ]),
    );
  });

  it('filters by state and search', async () => {
    const em = suite.orm.em;
    const { cookie, userId } = await login(em);

    const word = factories(em).word.makeOne({
      lemma: `perambulate-${uuidv7().slice(0, 8)}`,
    });
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Verb,
    });
    const skippedPhrase = factories(em).phrase.makeOne({
      phraseText: `at loose ends-${uuidv7().slice(0, 8)}`,
    });
    await em.flush();

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordDefinitionId: definition.id })
      .expect(HttpStatus.OK);
    factories(em).learningDisposition.makeOne({
      userId,
      phraseId: skippedPhrase.id,
      disposition: Disposition.Skipped,
    });
    await em.flush();

    const learningOnly = await suite
      .request('get', '/dictionary?state=learning')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(learningOnly.body.items).toHaveLength(1);
    expect(learningOnly.body.items[0].primary).toBe(word.lemma);

    const bySearch = await suite
      .request('get', `/dictionary?search=${encodeURIComponent('loose ends')}`)
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(bySearch.body.items).toHaveLength(1);
    expect(bySearch.body.items[0].primary).toBe(skippedPhrase.phraseText);
  });

  it('rejects a garbage cursor with 400', async () => {
    const em = suite.orm.em;
    const { cookie } = await login(em);
    await suite
      .request('get', '/dictionary?cursor=not-a-real-cursor')
      .set('Cookie', cookie)
      .expect(HttpStatus.BAD_REQUEST);
  });
});
