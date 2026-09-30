import { Command, CommandRunner } from 'nest-commander';
import { PostBackfillTranslationsCommand } from './post-backfill-translations.command.js';
import { PostDevSeedCommand } from './post-dev-seed.command.js';
import { PostIngestCommand } from './post-ingest.command.js';

@Command({
  name: 'post',
  subCommands: [
    PostIngestCommand,
    PostDevSeedCommand,
    PostBackfillTranslationsCommand,
  ],
  description: 'Post ingestion commands',
})
export class PostCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
