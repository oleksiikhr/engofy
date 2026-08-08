import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { CliCommandRunner } from '../cli-command.runner.js';

@SubCommand({ name: 'down', description: 'Revert the last applied migration' })
export class MigrateDownCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    this.logger.log('Reverting last migration...');

    await this.orm.migrator.down();

    this.logger.log('Done');
  }
}
