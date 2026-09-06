import { CliModule } from './cli.module.js';
import { GrammarCliModule } from './grammar/grammar-cli.module.js';
import { MigrateCliModule } from './migrate/migrate-cli.module.js';
import { PostCliModule } from './post/post-cli.module.js';
import { QueueCliModule } from './queue/queue-cli.module.js';
import { SentryCliModule } from './sentry/sentry-cli.module.js';
import { WordsCliModule } from './words/words-cli.module.js';

describe('CliModule.forCommand', () => {
  it('loads only the sub-module for a known command', () => {
    const { imports } = CliModule.forCommand('sentry');

    expect(imports).toEqual([SentryCliModule]);
  });

  it('loads every sub-module when the command is unrecognized', () => {
    const { imports } = CliModule.forCommand('nope');

    expect(imports).toEqual(
      expect.arrayContaining([
        SentryCliModule,
        MigrateCliModule,
        QueueCliModule,
        PostCliModule,
        GrammarCliModule,
        WordsCliModule,
      ]),
    );
    expect(imports).toHaveLength(6);
  });

  it('loads every sub-module when no command is given', () => {
    const { imports } = CliModule.forCommand();

    expect(imports).toHaveLength(6);
  });
});
