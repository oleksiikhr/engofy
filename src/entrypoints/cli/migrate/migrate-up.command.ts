import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { CliCommandRunner } from '../cli-command.runner.js';

@SubCommand({ name: 'up', description: 'Run all pending migrations' })
export class MigrateUpCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    this.logger.log('Running pending migrations...');

    const migrations = await this.orm.migrator.up();

    if (migrations.length === 0) {
      this.logger.log('No pending migrations');
    } else {
      this.logger.log(`Applied ${migrations.length} migration(s)`);
    }
  }
}
