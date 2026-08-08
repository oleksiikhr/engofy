import { Logger } from '@nestjs/common';
import { Option, SubCommand } from 'nest-commander';
import { QueueManagementService } from '../../../core/queue/queue-management.service.js';
import { ALL_QUEUE_NAMES } from '../../../core/queue/queue-names.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';
import { InvalidCliFlagError } from '../invalid-cli-flag.error.js';

interface StatsOptions {
  queue: string;
}

@SubCommand({
  name: 'stats',
  description: 'Print job counts per queue and state',
})
export class QueueStatsCommand extends CliCommandRunner<StatsOptions> {
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

  protected async execute(_: string[], options: StatsOptions): Promise<void> {
    const stats = await this.queueManagement.getStats(options.queue);

    for (const stat of stats) {
      this.logger.log(stat, 'queue stats');
    }
  }
}
