import { Command, CommandRunner } from 'nest-commander';
import { ContentIngestCommand } from './content-ingest.command.js';

@Command({
  name: 'content',
  subCommands: [ContentIngestCommand],
  description: 'Content ingestion commands',
})
export class ContentCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
