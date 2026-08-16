import { randomUUID } from 'node:crypto';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import AuthConfig from '../../config/auth.config.js';
import { generateToken, hashSecret } from '../../crypto/token.helper.js';
import { AuthSession } from '../../entities/auth-session.entity.js';
import { LogoutCommand } from './logout.command.js';

describe('LogoutHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('removes the session matching the given token', async () => {
    const config = suite.moduleRef.get<ConfigType<typeof AuthConfig>>(
      AuthConfig.KEY,
    );
    const token = generateToken();
    suite.orm.em.create(AuthSession, {
      userId: randomUUID(),
      tokenHash: hashSecret(token),
      expiresAt: DateTime.now().plus({ milliseconds: config.sessionTtlMs }),
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    await suite.command(new LogoutCommand({ sessionToken: token }));

    await expect(
      suite.orm.em.findOne(AuthSession, { tokenHash: hashSecret(token) }),
    ).resolves.toBeNull();
  });

  it('is a no-op for a token with no matching session', async () => {
    await expect(
      suite.command(new LogoutCommand({ sessionToken: 'not-a-real-token' })),
    ).resolves.toBeUndefined();
  });
});
