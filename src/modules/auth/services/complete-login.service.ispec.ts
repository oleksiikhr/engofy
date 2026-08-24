import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../auth.module.js';
import { AuthSession } from '../entities/auth-session.entity.js';
import { User } from '../entities/user.entity.js';
import { CompleteLoginService } from './complete-login.service.js';

describe('CompleteLoginService', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  let completeLogin: CompleteLoginService;

  const uniqueEmail = () => `user-${randomUUID()}@example.com`;

  beforeAll(() => {
    completeLogin = suite.moduleRef.get(CompleteLoginService);
  });

  describe('loginByEmail', () => {
    it('creates a new user and session for a first-time email', async () => {
      const email = uniqueEmail();

      const result = await completeLogin.loginByEmail(email);
      await suite.orm.em.flush();

      expect(result.sessionToken).toBeTruthy();

      const user = await suite.orm.em.findOneOrFail(User, {
        id: result.userId,
      });
      expect(user.email).toBe(email);
      expect(user.googleSub).toBeNull();

      const session = await suite.orm.em.findOneOrFail(AuthSession, {
        userId: result.userId,
      });
      expect(session).toBeTruthy();
    });

    it('reuses the existing user for a known email', async () => {
      const email = uniqueEmail();
      const existing = suite.orm.em.create(User, { email, googleSub: null });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      const result = await completeLogin.loginByEmail(email);
      await suite.orm.em.flush();

      expect(result.userId).toBe(existing.id);
    });
  });

  describe('loginByGoogle', () => {
    it('creates a new user with the given email and googleSub', async () => {
      const email = uniqueEmail();
      const googleSub = `sub-${randomUUID()}`;

      const result = await completeLogin.loginByGoogle(email, googleSub);
      await suite.orm.em.flush();

      const user = await suite.orm.em.findOneOrFail(User, {
        id: result.userId,
      });
      expect(user.email).toBe(email);
      expect(user.googleSub).toBe(googleSub);
    });

    it('backfills googleSub onto an existing user found by email', async () => {
      const email = uniqueEmail();
      const existing = suite.orm.em.create(User, { email, googleSub: null });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      const googleSub = `sub-${randomUUID()}`;
      const result = await completeLogin.loginByGoogle(email, googleSub);
      await suite.orm.em.flush();

      expect(result.userId).toBe(existing.id);

      const user = await suite.orm.em.findOneOrFail(User, {
        id: existing.id,
      });
      expect(user.googleSub).toBe(googleSub);
    });
  });
});
