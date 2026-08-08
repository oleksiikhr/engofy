import { Command, CommandRunner } from 'nest-commander';
import { QueueDeleteAllCommand } from './queue-delete-all.command.js';
import { QueueRetryFailedCommand } from './queue-retry-failed.command.js';
import { QueueStatsCommand } from './queue-stats.command.js';
import { SendExampleCommand } from './send-example.command.js';

@Command({
  name: 'queue',
  description: 'Queue commands',
  subCommands: [
    QueueStatsCommand,
    QueueRetryFailedCommand,
    QueueDeleteAllCommand,
    SendExampleCommand,
  ],
})
export class QueueCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
