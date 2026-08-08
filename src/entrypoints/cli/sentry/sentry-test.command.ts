import { SubCommand } from 'nest-commander';
import { CliCommandRunner } from '../cli-command.runner.js';

@SubCommand({ name: 'test', description: 'Send a test event to Sentry' })
export class SentryTestCommand extends CliCommandRunner {
  protected async execute(): Promise<void> {
    throw new Error('Test exception');
  }
}
