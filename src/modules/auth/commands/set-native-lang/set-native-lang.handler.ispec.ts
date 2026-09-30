import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { ContentLanguage } from '../../../post/enums/content-language.enum.js';
import { AuthModule } from '../../auth.module.js';
import { User } from '../../entities/user.entity.js';
import { SetNativeLangCommand } from './set-native-lang.command.js';

describe('SetNativeLangHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('updates the user native language and returns it', async () => {
    const user = suite.factories.user.makeOne({
      email: `user-${randomUUID()}@example.com`,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const result = await suite.command(
      new SetNativeLangCommand(user.id, ContentLanguage.Uk),
    );

    expect(result).toBe(ContentLanguage.Uk);

    const updated = await suite.orm.em.findOneOrFail(User, { id: user.id });
    expect(updated.nativeLang).toBe(ContentLanguage.Uk);
  });
});
