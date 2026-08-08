import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { MigrateUpCommand } from './migrate-up.command.js';

describe('MigrateUpCommand', () => {
  let command: MigrateUpCommand;
  let migratorUp: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    migratorUp = vi.fn();
    command = injectOrm(new MigrateUpCommand(), {
      migrator: { up: migratorUp },
    });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls migrator.up()', async () => {
    migratorUp.mockResolvedValue([]);

    await command.run([]);

    expect(migratorUp).toHaveBeenCalledOnce();
  });

  it('logs "No pending migrations" when none are pending', async () => {
    migratorUp.mockResolvedValue([]);

    await command.run([]);

    expect(logSpy).toHaveBeenCalledWith('No pending migrations');
  });

  it('logs applied count when migrations were applied', async () => {
    migratorUp.mockResolvedValue([
      { name: 'Migration1' },
      { name: 'Migration2' },
    ]);

    await command.run([]);

    expect(logSpy).toHaveBeenCalledWith('Applied 2 migration(s)');
  });
});
