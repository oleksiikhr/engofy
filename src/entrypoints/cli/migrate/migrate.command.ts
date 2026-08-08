import { Command, CommandRunner } from 'nest-commander';
import { MigrateDownCommand } from './migrate-down.command.js';
import { MigrateUpCommand } from './migrate-up.command.js';

@Command({
  name: 'migrate',
  subCommands: [MigrateUpCommand, MigrateDownCommand],
  description: 'Database migration commands',
})
export class MigrateCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
