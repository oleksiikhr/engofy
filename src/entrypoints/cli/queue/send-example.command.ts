import type { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { OutboxSenderService } from '../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../core/queue/queue-names.enum.js';
import type { ExampleJobData } from '../../worker/example/example.processor.js';
import { CliCommandRunner } from '../cli-command.runner.js';

@SubCommand({
  name: 'send-example',
  description: 'Send a test job to the example queue via the outbox pattern',
})
export class SendExampleCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly outbox: OutboxSenderService) {
    super();
  }

  protected async execute(): Promise<void> {
    const jobId = await this.orm.em.transactional((em) =>
      this.outbox.send<ExampleJobData>(em as EntityManager, QueueName.Example, {
        message: 'Hello from CLI',
      }),
    );

    this.logger.log(`Queued example job ${jobId}`);
  }
}
