import { Command } from '@nestjs/cqrs';

export type ReportedLabelKind = 'word' | 'phrase' | 'grammar';

export class ReportLabelCommand extends Command<void> {
  constructor(
    // Null for a guest.
    readonly userId: string | null,
    readonly shortId: string,
    readonly kind: ReportedLabelKind,
    // wordDefinitionId / phraseId / grammarUsagePointId, per `kind`.
    readonly targetId: string,
  ) {
    super();
  }
}
