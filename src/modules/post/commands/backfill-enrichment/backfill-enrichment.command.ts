import { Command } from '@nestjs/cqrs';

export interface BackfillEnrichmentResult {
  enqueued: number;
}

export class BackfillEnrichmentCommand extends Command<BackfillEnrichmentResult> {}
