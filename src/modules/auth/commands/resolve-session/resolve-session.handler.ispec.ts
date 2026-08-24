import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
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
    const token = await sessions.create(userId);
    await suite.orm.em.flush();

    const result = await suite.command(new ResolveSessionCommand({ token }));

    expect(result).toEqual({ userId });
  });

  it('returns null for an unknown token', async () => {
    const result = await suite.command(
      new ResolveSessionCommand({ token: 'not-a-real-token' }),
    );

    expect(result).toBeNull();
  });
});
