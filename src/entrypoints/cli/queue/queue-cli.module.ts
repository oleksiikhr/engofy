import { Module } from '@nestjs/common';
import { QueueCommand } from './queue.command.js';
import { QueueDeleteAllCommand } from './queue-delete-all.command.js';
import { QueueRetryFailedCommand } from './queue-retry-failed.command.js';
import { QueueStatsCommand } from './queue-stats.command.js';
import { SendExampleCommand } from './send-example.command.js';

@Module({
  providers: [
    QueueCommand,
    QueueStatsCommand,
    QueueRetryFailedCommand,
    QueueDeleteAllCommand,
    SendExampleCommand,
  ],
})
export class QueueCliModule {}
