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
import { AuthWebModule } from '../../auth/auth-web.module.js';
import { BillingWebModule } from '../billing-web.module.js';

describe('BillingController', () => {
  const suite = createWebE2ESuite({
    imports: [BillingWebModule, AuthWebModule],
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

  it('reports the free plan before any subscription', async () => {
    const cookie = await login(suite.orm.em);
    const res = await suite
      .request('get', '/billing/subscription')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(res.body).toMatchObject({ plan: 'free', active: false });
  });

  it('activates a mock premium subscription and reads it back', async () => {
    const cookie = await login(suite.orm.em);

    const subscribed = await suite
      .request('post', '/billing/subscribe')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(subscribed.body).toMatchObject({
      plan: 'premium',
      active: true,
      isMockPayment: true,
    });
    expect(typeof subscribed.body.currentPeriodEnd).toBe('string');

    const current = await suite
      .request('get', '/billing/subscription')
      .set('Cookie', cookie)
      .expect(HttpStatus.OK);
    expect(current.body).toMatchObject({ plan: 'premium', active: true });
  });
});
