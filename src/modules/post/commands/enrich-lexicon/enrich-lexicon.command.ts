import { Command } from '@nestjs/cqrs';
import type { ContentLanguage } from '../../enums/content-language.enum.js';

export class EnrichLexiconCommand extends Command<void> {
  // Only the backfill names languages: it re-runs a completed stage for them.
  // Without it the stage fills every `ENRICHMENT_LANGUAGES` language once.
  constructor(
    readonly postId: string,
    readonly languages?: readonly ContentLanguage[],
  ) {
    super();
  }
}
