import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { AuthModule } from '../../auth.module.js';
import { User } from '../../entities/user.entity.js';
import { SetCefrLevelCommand } from './set-cefr-level.command.js';

describe('SetCefrLevelHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  const uniqueEmail = () => `user-${randomUUID()}@example.com`;

  it('updates the user CEFR level and returns it', async () => {
    const user = suite.factories.user.makeOne({ email: uniqueEmail() });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const result = await suite.command(
      new SetCefrLevelCommand(user.id, CefrLevel.B2),
    );

    expect(result).toBe(CefrLevel.B2);

    const updated = await suite.orm.em.findOneOrFail(User, { id: user.id });
    expect(updated.cefrLevel).toBe(CefrLevel.B2);
  });
});
