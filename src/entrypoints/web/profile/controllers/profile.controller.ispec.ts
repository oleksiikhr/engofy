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
import { AccountDeletionRequest } from '../../../../modules/auth/entities/account-deletion-request.entity.js';
import { AuthSession } from '../../../../modules/auth/entities/auth-session.entity.js';
import { User } from '../../../../modules/auth/entities/user.entity.js';
import { Subscription } from '../../../../modules/billing/entities/subscription.entity.js';
import { SubscriptionPlan } from '../../../../modules/billing/enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../../../modules/billing/enums/subscription-status.enum.js';
import { GrammarCategory } from '../../../../modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../../modules/post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../../modules/post/entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { BillingWebModule } from '../../billing/billing-web.module.js';
import { LearningWebModule } from '../../learning/learning-web.module.js';
import { ProfileWebModule } from '../profile-web.module.js';

describe('ProfileController', () => {
  const suite = createWebE2ESuite({
    imports: [
      ProfileWebModule,
      LearningWebModule,
      AuthWebModule,
      BillingWebModule,
    ],
  });

  const cookieName = () =>
    suite.app.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY, {
      strict: false,
    }).sessionCookieName;

  async function loginAs(
    em: EntityManager,
  ): Promise<{ cookie: string; userId: string }> {
    const user = em.create(User, { email: `u-${uuidv7()}@example.com` });
    const token = generateToken();
    em.create(AuthSession, {
      userId: user.id,
      tokenHash: hashSecret(token),
      expiresAt: DateTime.now().plus({ days: 1 }),
    });
    await em.flush();
    return { cookie: `${cookieName()}=${token}`, userId: user.id };
  }

  const login = async (em: EntityManager): Promise<string> =>
    (await loginAs(em)).cookie;

  it('rejects an unauthenticated request', async () => {
    await suite.request('get', '/profile').expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns the streak and self-reported CEFR level', async () => {
    const cookie = await login(suite.orm.em);

    const res = await suite
      .request('get', '/profile')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);

    expect(res.body).toEqual({
      streak: 0,
      cefrLevel: 'A1',
      accountDeletion: null,
    });
  });

  describe('GET /profile/progress', () => {
    it('rejects an unauthenticated request', async () => {
      await suite
        .request('get', '/profile/progress')
        .expect(HttpStatus.UNAUTHORIZED);
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
        .request('get', '/profile/progress')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      expect(res.body.streak).toBe(0);
      expect(res.body.activityDays).toEqual([]);
      expect(res.body.cefr).toMatchObject({ A2: 1 });
      expect(res.body.cefrLevel).toBeUndefined();
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

  describe('GET /profile/subscription', () => {
    it('rejects an unauthenticated request', async () => {
      await suite
        .request('get', '/profile/subscription')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('returns the free plan with the card cap and usage', async () => {
      const cookie = await login(suite.orm.em);

      const res = await suite
        .request('get', '/profile/subscription')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      expect(res.body).toEqual({
        plan: 'free',
        active: false,
        currentPeriodEnd: null,
        cardsUsed: 0,
        cardLimit: 100,
      });
    });

    it('returns the premium plan and its renewal date with no cap', async () => {
      const { cookie, userId } = await loginAs(suite.orm.em);
      const periodEnd = DateTime.now().plus({ days: 20 });
      suite.orm.em.create(Subscription, {
        userId,
        plan: SubscriptionPlan.Premium,
        status: SubscriptionStatus.Active,
        currentPeriodEnd: periodEnd,
      });
      await suite.orm.em.flush();

      const res = await suite
        .request('get', '/profile/subscription')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      expect(res.body).toMatchObject({
        plan: 'premium',
        active: true,
        cardsUsed: 0,
        cardLimit: null,
      });
      expect(DateTime.fromISO(res.body.currentPeriodEnd).toMillis()).toBe(
        periodEnd.toMillis(),
      );
    });
  });

  describe('PATCH /profile/cefr-level', () => {
    it('rejects an unauthenticated request', async () => {
      await suite
        .request('patch', '/profile/cefr-level')
        .send({ cefrLevel: CefrLevel.B1 })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('updates the level and reflects it on the next GET /profile', async () => {
      const cookie = await login(suite.orm.em);

      const patchRes = await suite
        .request('patch', '/profile/cefr-level')
        .set('Cookie', cookie)
        .send({ cefrLevel: CefrLevel.B1 })
        .expect(HttpStatus.OK);

      expect(patchRes.body).toEqual({ cefrLevel: 'B1' });

      const getRes = await suite
        .request('get', '/profile')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      expect(getRes.body.cefrLevel).toBe('B1');
    });

    it('rejects an invalid level', async () => {
      const cookie = await login(suite.orm.em);

      await suite
        .request('patch', '/profile/cefr-level')
        .set('Cookie', cookie)
        .send({ cefrLevel: 'not-a-level' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('account deletion', () => {
    it('rejects an unauthenticated request', async () => {
      await suite
        .request('post', '/profile/account-deletion')
        .expect(HttpStatus.UNAUTHORIZED);
      await suite
        .request('post', '/profile/account-deletion/cancel')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('requests deletion, ends premium and surfaces the request on GET /profile', async () => {
      const { cookie, userId } = await loginAs(suite.orm.em);
      suite.orm.em.create(Subscription, {
        userId,
        plan: SubscriptionPlan.Premium,
        status: SubscriptionStatus.Active,
        currentPeriodEnd: DateTime.now().plus({ days: 20 }),
      });
      await suite.orm.em.flush();

      const res = await suite
        .request('post', '/profile/account-deletion')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      const requestedAt = DateTime.fromISO(res.body.requestedAt);
      const scheduledFor = DateTime.fromISO(res.body.scheduledFor);
      expect(scheduledFor.diff(requestedAt).as('days')).toBe(30);

      const subscription = await suite
        .request('get', '/billing/subscription')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);
      expect(subscription.body.active).toBe(false);

      const hub = await suite
        .request('get', '/profile')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);
      expect(hub.body.accountDeletion).toEqual(res.body);
    });

    it('cancels from the hub banner and clears the request', async () => {
      const cookie = await login(suite.orm.em);
      await suite
        .request('post', '/profile/account-deletion')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      await suite
        .request('post', '/profile/account-deletion/cancel')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      const hub = await suite
        .request('get', '/profile')
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);
      expect(hub.body.accountDeletion).toBeNull();

      await suite
        .request('post', '/profile/account-deletion/cancel')
        .set('Cookie', cookie)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('cancels from the e-mailed link without a session', async () => {
      const { userId } = await loginAs(suite.orm.em);
      const token = generateToken();
      suite.orm.em.create(AccountDeletionRequest, {
        userId,
        cancelTokenHash: hashSecret(token),
      });
      await suite.orm.em.flush();

      await suite
        .request('post', '/profile/account-deletion/cancel-by-token')
        .send({ token })
        .expect(HttpStatus.OK);

      await suite
        .request('post', '/profile/account-deletion/cancel-by-token')
        .send({ token })
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
