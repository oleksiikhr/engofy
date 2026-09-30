import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { ContentLanguage } from '../../../post/enums/content-language.enum.js';
import { AuthModule } from '../../auth.module.js';
import { ResolveNativeLangQuery } from './resolve-native-lang.query.js';

describe('ResolveNativeLangHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it("uses the account's language when signed in", async () => {
    const user = suite.factories.user.makeOne({
      email: `user-${randomUUID()}@example.com`,
    });
    await suite.orm.em.flush();

    const lang = await suite.query(
      new ResolveNativeLangQuery(user.id, 'garbage'),
    );

    expect(lang).toBe(user.nativeLang);
  });

  it('falls back to a valid guest cookie value', async () => {
    const lang = await suite.query(new ResolveNativeLangQuery(null, 'uk'));

    expect(lang).toBe(ContentLanguage.Uk);
  });

  it('defaults to Ukrainian for a missing or unknown cookie', async () => {
    expect(await suite.query(new ResolveNativeLangQuery(null, undefined))).toBe(
      ContentLanguage.Uk,
    );
    expect(await suite.query(new ResolveNativeLangQuery(null, 'xx'))).toBe(
      ContentLanguage.Uk,
    );
  });
});
