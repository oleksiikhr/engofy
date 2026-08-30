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
import { GrammarCategory } from '../../../../modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../../modules/post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../../modules/post/entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { LearningWebModule } from '../../learning/learning-web.module.js';
import { ProfileWebModule } from '../profile-web.module.js';

describe('ProfileController', () => {
  const suite = createWebE2ESuite({
    imports: [ProfileWebModule, LearningWebModule, AuthWebModule],
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
    await suite.request('get', '/profile').expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns the skills tree, streak and CEFR breakdown', async () => {
    const cookie = await login(suite.orm.em);

    const category = suite.orm.em.create(GrammarCategory, {
      name: `CAT-${uuidv7()}`,
      sortOrder: 1,
    });
    const construction = suite.orm.em.create(GrammarConstruction, {
      categoryId: category.id,
      name: 'present simple',
      slug: `slug-${uuidv7()}`,
      sortOrder: 1,
    });
    const point = suite.orm.em.create(GrammarUsagePoint, {
      constructionId: construction.id,
      cefrLevel: CefrLevel.A2,
      guideword: 'USE: habits',
      canDoStatement: 'Can describe habits.',
    });
    await suite.orm.em.flush();

    await suite
      .request('post', '/learning/cards')
      .set('Cookie', cookie)
      .send({ grammarUsagePointId: point.id })
      .expect(HttpStatus.OK);

    const res = await suite
      .request('get', '/profile')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body.streak).toBe(0);
    expect(res.body.cefr).toMatchObject({ A2: 1 });
    const seeded = res.body.categories.find(
      (c: { name: string }) => c.name === category.name,
    );
    expect(seeded.constructions[0]).toMatchObject({
      slug: construction.slug,
      cefrLevel: 'A2',
      locked: false,
      masteryScore: 0,
    });
  });
});
