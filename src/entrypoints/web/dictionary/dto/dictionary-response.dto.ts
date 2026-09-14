import type { CursorPage } from '../../../../core/http/dto/cursor-page.js';
import type { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class DictionaryPostRefDto {
  readonly shortId!: string;

  readonly slug!: string | null;

  readonly title!: string | null;
}

export class DictionaryEntryDto {
  readonly type!: 'word' | 'phrase';

  // Also the `/dictionary/[lemma]` / `/dictionary/[phrase]` route param.
  readonly primary!: string;

  // Never `EffectiveState.New` — see `GetDictionaryHandler`.
  readonly state!: EffectiveState;

  readonly senseCount!: number;

  // Part of speech for a word; null for a phrase.
  readonly secondary!: string | null;

  readonly definition!: string | null;

  readonly example!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  // Published posts that use this term.
  readonly posts!: DictionaryPostRefDto[];
}

export class DictionaryResponseDto implements CursorPage<DictionaryEntryDto> {
  readonly items!: DictionaryEntryDto[];

  readonly nextCursor!: string | null;
}
