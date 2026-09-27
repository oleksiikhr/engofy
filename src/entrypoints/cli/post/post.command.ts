import { Command, CommandRunner } from 'nest-commander';
import { PostDevSeedCommand } from './post-dev-seed.command.js';
import { PostIngestCommand } from './post-ingest.command.js';

@Command({
  name: 'post',
  subCommands: [PostIngestCommand, PostDevSeedCommand],
  description: 'Post ingestion commands',
})
export class PostCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
