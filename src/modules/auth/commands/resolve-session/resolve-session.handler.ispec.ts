import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { AuthSession } from '../../entities/auth-session.entity.js';
import { SessionService } from '../../services/session.service.js';
import { ResolveSessionCommand } from './resolve-session.command.js';

describe('ResolveSessionHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  let sessions: SessionService;

  beforeAll(() => {
    sessions = suite.moduleRef.get(SessionService);
  });

  it('resolves the owning user ID for a valid session token', async () => {
    const userId = randomUUID();
    const token = sessions.create(userId);
    await suite.orm.em.flush();

    const result = await suite.command(
      new ResolveSessionCommand({ sessionToken: token }),
    );

    expect(result).toEqual({ userId });
  });

  it('returns null for an unknown token', async () => {
    const result = await suite.command(
      new ResolveSessionCommand({ sessionToken: 'not-a-real-token' }),
    );

    expect(result).toBeNull();
  });

  it('slides the expiry of a session close to its TTL (awaited refresh)', async () => {
    const userId = randomUUID();
    const token = sessions.create(userId);
    const session = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    session.expiresAt = DateTime.now().plus({ days: 5 });
    await suite.orm.em.flush();

    await suite.command(new ResolveSessionCommand({ sessionToken: token }));

    const refreshed = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    expect(refreshed.expiresAt > DateTime.now().plus({ days: 20 })).toBe(true);
  });

  it('leaves a far-from-expiry session untouched', async () => {
    const userId = randomUUID();
    const token = sessions.create(userId);
    const farExpiry = DateTime.now().plus({ days: 25 });
    const session = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    session.expiresAt = farExpiry;
    await suite.orm.em.flush();

    await suite.command(new ResolveSessionCommand({ sessionToken: token }));

    const after = await suite.orm.em.findOneOrFail(AuthSession, { userId });
    expect(after.expiresAt.toMillis()).toBe(farExpiry.toMillis());
  });
});
