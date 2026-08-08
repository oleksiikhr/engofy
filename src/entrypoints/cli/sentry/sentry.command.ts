import { Command, CommandRunner } from 'nest-commander';
import { SentryTestCommand } from './sentry-test.command.js';

@Command({
  name: 'sentry',
  description: 'Sentry integration commands',
  subCommands: [SentryTestCommand],
})
export class SentryCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
