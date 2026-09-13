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
import { Post } from '../../../../modules/post/entities/post.entity.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { PostSourceFormat } from '../../../../modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../../modules/post/enums/post-status.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { HomeWebModule } from '../home-web.module.js';

describe('HomeController', () => {
  const suite = createWebE2ESuite({
    imports: [HomeWebModule, AuthWebModule],
  });

  const cookieName = () =>
    suite.app.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY, {
      strict: false,
    }).sessionCookieName;

  async function login(
    em: EntityManager,
    cefrLevel: CefrLevel = CefrLevel.A1,
  ): Promise<string> {
    const user = em.create(User, {
      email: `u-${uuidv7()}@example.com`,
      cefrLevel,
    });
    const token = generateToken();
    em.create(AuthSession, {
      userId: user.id,
      tokenHash: hashSecret(token),
      expiresAt: DateTime.now().plus({ days: 1 }),
    });
    await em.flush();
    return `${cookieName()}=${token}`;
  }

  async function seedPost(em: EntityManager): Promise<Post> {
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'Some text.';
    const post = new Post();
    post.source = source;
    post.status = PostStatus.Published;
    post.title = 'A post';
    post.cefrLevel = CefrLevel.A1;
    em.persist(post);
    await em.flush();
    return post;
  }

  it('rejects an unauthenticated request', async () => {
    await suite
      .request('get', '/home/daily-plan')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('selects and then keeps returning the same daily plan', async () => {
    const cookie = await login(suite.orm.em);
    const post = await seedPost(suite.orm.em);

    const first = await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(first.body).toMatchObject({
      postShortId: post.shortId,
      completedAt: null,
    });

    const second = await suite
      .request('get', '/home/daily-plan')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(second.body).toEqual(first.body);
  });
});
