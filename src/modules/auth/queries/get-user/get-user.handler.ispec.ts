import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { User } from '../../entities/user.entity.js';
import { GetUserQuery } from './get-user.query.js';

describe('GetUserHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('returns the user matching the given id', async () => {
    const user = suite.orm.em.create(User, {
      email: `${randomUUID()}@example.com`,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const result = await suite.query(new GetUserQuery(user.id));

    expect(result.id).toBe(user.id);
    expect(result.email).toBe(user.email);
  });

  it('rejects for an id with no matching user', async () => {
    await expect(suite.query(new GetUserQuery(randomUUID()))).rejects.toThrow();
  });
});
