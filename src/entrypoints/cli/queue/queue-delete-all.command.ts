import { Logger } from '@nestjs/common';
import { Option, SubCommand } from 'nest-commander';
import { QueueManagementService } from '../../../core/queue/queue-management.service.js';
import { ALL_QUEUE_NAMES } from '../../../core/queue/queue-names.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';
import { InvalidCliFlagError } from '../invalid-cli-flag.error.js';

interface DeleteAllOptions {
  queue?: string;
  force: boolean;
}

@SubCommand({
  name: 'delete-all',
  description:
    'Permanently delete every job in a single named queue, including active ones (requires --force, no "all" target)',
})
export class QueueDeleteAllCommand extends CliCommandRunner<DeleteAllOptions> {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly queueManagement: QueueManagementService) {
    super();
  }

  @Option({
    flags: '-q, --queue <name>',
    description: `Queue name to delete jobs from. Valid: ${ALL_QUEUE_NAMES.join(', ')}`,
  })
  parseQueue(val: string): string {
    if (!(ALL_QUEUE_NAMES as readonly string[]).includes(val)) {
      throw new InvalidCliFlagError('--queue');
    }

    return val;
  }

  @Option({
    flags: '--force',
    description: 'Required confirmation flag to acknowledge permanent deletion',
    defaultValue: false,
  })
  parseForce(): boolean {
    return true;
  }

  protected async execute(
    _: string[],
    options: DeleteAllOptions,
  ): Promise<void> {
    if (!options.queue) {
      throw new InvalidCliFlagError('--queue');
    }

    if (!options.force) {
      throw new InvalidCliFlagError('--force');
    }

    this.logger.log({ queue: options.queue }, 'deleting all jobs');

    await this.queueManagement.deleteAll(options.queue);

    this.logger.log({ queue: options.queue }, 'all jobs deleted');
  }
}
