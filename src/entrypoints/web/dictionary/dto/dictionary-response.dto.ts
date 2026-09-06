import type { OffsetPage } from '../../../../core/http/dto/offset-page.js';
import type { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class DictionaryPostRefDto {
  readonly shortId!: string;

  readonly slug!: string | null;

  readonly title!: string | null;
}

export class DictionaryEntryDto {
  readonly cardId!: string;

  readonly type!: 'word' | 'phrase';

  // SRS card target id (wordId / phraseId).
  readonly targetId!: string;

  readonly state!: LearningCardState;

  // ISO-8601.
  readonly due!: string;

  readonly primary!: string;

  // Part of speech for a word; null for a phrase.
  readonly secondary!: string | null;

  readonly definition!: string | null;

  readonly example!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  // Published posts that use this term.
  readonly posts!: DictionaryPostRefDto[];
}

// Shares the `{ items, nextOffset }` envelope with every other list endpoint
// (D14 #36). The dictionary is returned whole — every card, no offset param —
// so `nextOffset` is always `null`; the field is here for wire consistency, not
// because this endpoint paginates.
export class DictionaryResponseDto implements OffsetPage<DictionaryEntryDto> {
  readonly items!: DictionaryEntryDto[];

  readonly nextOffset!: number | null;
}
