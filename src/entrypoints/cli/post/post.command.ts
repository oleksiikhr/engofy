import { Command, CommandRunner } from 'nest-commander';
import { PostIngestCommand } from './post-ingest.command.js';

@Command({
  name: 'post',
  subCommands: [PostIngestCommand],
  description: 'Post ingestion commands',
})
export class PostCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
