import { Command, CommandRunner } from 'nest-commander';
import { PostBackfillEnrichmentCommand } from './post-backfill-enrichment.command.js';
import { PostIngestCommand } from './post-ingest.command.js';

@Command({
  name: 'post',
  subCommands: [PostIngestCommand, PostBackfillEnrichmentCommand],
  description: 'Post ingestion commands',
})
export class PostCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
