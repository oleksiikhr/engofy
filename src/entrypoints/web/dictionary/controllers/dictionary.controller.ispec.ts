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
import { PostSource } from '../../../../modules/post/embeddables/post-source.embeddable.js';
import { Phrase } from '../../../../modules/post/entities/phrase.entity.js';
import { Post } from '../../../../modules/post/entities/post.entity.js';
import { PostPart } from '../../../../modules/post/entities/post-part.entity.js';
import { Word } from '../../../../modules/post/entities/word.entity.js';
import { WordDefinition } from '../../../../modules/post/entities/word-definition.entity.js';
import { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';
import { PostPartKind } from '../../../../modules/post/enums/post-part-kind.enum.js';
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
    await suite.request('get', '/dictionary').expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns word cards with status and the posts they appear in', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);

    const word = em.create(Word, { lemma: `harbour-${uuidv7().slice(0, 8)}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'a sheltered stretch of water',
    });
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'The harbour was calm.';
    const post = new Post();
    post.source = source;
    post.title = 'Down by the Water';
    post.slug = 'down-by-the-water';
    post.status = PostStatus.Published;
    em.persist(post);
    em.create(PostPart, {
      postId: post.id,
      blockIndex: 0,
      kind: PostPartKind.Paragraph,
      body: {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'The ' },
          {
            type: 'span',
            kind: 'word',
            text: 'harbour',
            wordDefinitionId: definition.id,
            pos: 'NOUN',
          },
          { type: 'text', text: ' was calm.' },
        ],
      },
    });
    await em.flush();

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ wordId: word.id })
      .expect(HttpStatus.OK);

    const res = await suite
      .request('get', '/dictionary')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      type: 'word',
      targetId: word.id,
      state: 'new',
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

  it('includes phrase cards and omits grammar cards', async () => {
    const em = suite.orm.em;
    const cookie = await login(em);

    const phrase = em.create(Phrase, {
      phraseText: `pick up-${uuidv7().slice(0, 8)}`,
      definition: 'to collect someone',
    });
    await em.flush();

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ phraseId: phrase.id })
      .expect(HttpStatus.OK);

    const res = await suite
      .request('get', '/dictionary')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body.items).toEqual([
      expect.objectContaining({
        type: 'phrase',
        targetId: phrase.id,
        primary: phrase.phraseText,
        posts: [],
      }),
    ]);
  });
});
