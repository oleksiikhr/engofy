import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { MigrateDownCommand } from './migrate-down.command.js';

describe('MigrateDownCommand', () => {
  let command: MigrateDownCommand;
  let migratorDown: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    migratorDown = vi.fn();
    command = injectOrm(new MigrateDownCommand(), {
      migrator: { down: migratorDown },
    });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls migrator.down()', async () => {
    migratorDown.mockResolvedValue(undefined);

    await command.run([]);

    expect(migratorDown).toHaveBeenCalledOnce();
  });

  it('logs "Reverting last migration..." before running', async () => {
    migratorDown.mockResolvedValue(undefined);

    await command.run([]);

    expect(logSpy).toHaveBeenNthCalledWith(1, 'Reverting last migration...');
  });

  it('logs "Done" after successful revert', async () => {
    migratorDown.mockResolvedValue(undefined);

    await command.run([]);

    expect(logSpy).toHaveBeenNthCalledWith(2, 'Done');
  });

  it('propagates error when migrator.down() rejects', async () => {
    const error = new Error('migration failed');
    migratorDown.mockRejectedValue(error);

    await expect(command.run([])).rejects.toThrow('migration failed');
    expect(logSpy).toHaveBeenCalledWith('Reverting last migration...');
  });
});
