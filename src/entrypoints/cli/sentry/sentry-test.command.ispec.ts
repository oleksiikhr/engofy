import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { CliModule } from '../cli.module.js';
import { SentryTestCommand } from './sentry-test.command.js';

describe('SentryTestCommand', () => {
  const suite = createIntegrationSuite({
    imports: [CliModule.forCommand('sentry')],
  });

  it('throws an Error', async () => {
    const command = suite.moduleRef.get(SentryTestCommand);
    await expect(command.run([])).rejects.toThrow('Test exception');
  });
});
