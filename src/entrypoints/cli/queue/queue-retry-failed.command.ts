import { Logger } from '@nestjs/common';
import { Option, SubCommand } from 'nest-commander';
import { QueueManagementService } from '../../../core/queue/queue-management.service.js';
import { ALL_QUEUE_NAMES } from '../../../core/queue/queue-names.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';
import { InvalidCliFlagError } from '../invalid-cli-flag.error.js';

interface RetryFailedOptions {
  queue: string;
}

@SubCommand({
  name: 'retry-failed',
  description:
    'Re-enqueue jobs in "failed" state (works without a configured dead-letter queue)',
})
export class QueueRetryFailedCommand extends CliCommandRunner<RetryFailedOptions> {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly queueManagement: QueueManagementService) {
    super();
  }

  @Option({
    flags: '-q, --queue <name>',
    description: `Queue name or "all" (default: all). Valid: ${ALL_QUEUE_NAMES.join(', ')}`,
    defaultValue: 'all',
  })
  parseQueue(val: string): string {
    if (
      val !== 'all' &&
      !(ALL_QUEUE_NAMES as readonly string[]).includes(val)
    ) {
      throw new InvalidCliFlagError('--queue');
    }

    return val;
  }

  protected async execute(
    _: string[],
    options: RetryFailedOptions,
  ): Promise<void> {
    this.logger.log({ queue: options.queue }, 'retrying failed jobs');

    const count = await this.queueManagement.retryFailed(options.queue);

    this.logger.log({ queue: options.queue, count }, 'retry done');
  }
}
