import { randomUUID } from 'node:crypto';
import { type ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../auth.module.js';
import AuthConfig from '../config/auth.config.js';
import { AuthSession } from '../entities/auth-session.entity.js';
import { SessionService } from './session.service.js';

describe('SessionService', () => {
  let sessions: SessionService;
  let config: ConfigType<typeof AuthConfig>;

  const suite = createIntegrationSuite({
    imports: [AuthModule],
  });

  beforeAll(async () => {
    sessions = suite.moduleRef.get(SessionService);
    config = suite.moduleRef.get(AuthConfig.KEY);
  });

  it('resolves the owning user ID for a freshly created session', async () => {
    const userId = randomUUID();
    const token = await sessions.create(userId);
    await suite.orm.em.flush();

    await expect(sessions.resolveUserId(token)).resolves.toBe(userId);
  });

  it('returns null for an unknown token', async () => {
    await expect(
      sessions.resolveUserId('not-a-real-token'),
    ).resolves.toBeNull();
  });

  it('extends expiresAt once the remaining TTL drops below the refresh threshold', async () => {
    const userId = randomUUID();
    const token = await sessions.create(userId);
    await suite.orm.em.flush();

    const nearExpiry = DateTime.now().plus({ days: 1 });
    const session = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    session.expiresAt = nearExpiry;
    await suite.orm.em.flush();
    suite.orm.em.clear();

    await sessions.refresh(token);
    suite.orm.em.clear();

    const refreshed = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    expect(refreshed.expiresAt.toMillis()).toBeGreaterThan(
      nearExpiry.toMillis(),
    );
    expect(refreshed.expiresAt.toMillis()).toBeGreaterThan(
      DateTime.now().toMillis() + config.sessionTtlMs - 60_000,
    );
  });

  it('removes the session matching the given token', async () => {
    const userId = randomUUID();
    const token = await sessions.create(userId);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    await sessions.revoke(token);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    await expect(sessions.resolveUserId(token)).resolves.toBeNull();
  });

  it('is a no-op when revoking a token with no matching session', async () => {
    await expect(sessions.revoke('not-a-real-token')).resolves.toBeUndefined();
  });

  it('does not touch expiresAt when the session is not near expiry', async () => {
    const userId = randomUUID();
    const token = await sessions.create(userId);
    await suite.orm.em.flush();

    const before = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    const beforeExpiresAt = before.expiresAt.toMillis();
    suite.orm.em.clear();

    await sessions.refresh(token);
    suite.orm.em.clear();

    const after = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    expect(after.expiresAt.toMillis()).toBe(beforeExpiresAt);
  });
});
