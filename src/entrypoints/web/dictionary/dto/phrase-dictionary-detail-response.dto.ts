import type { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import type { PhraseType } from '../../../../modules/post/enums/phrase-type.enum.js';

export class PhraseDictionaryPostDto {
  readonly shortId!: string;

  readonly slug!: string | null;

  readonly title!: string | null;

  readonly isRead!: boolean;
}

export class PhraseDictionaryDetailResponseDto {
  readonly phraseId!: string;

  readonly phraseText!: string;

  readonly type!: PhraseType | null;

  readonly definition!: string | null;

  readonly example!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  readonly state!: EffectiveState;

  // Non-null only when an active LearningCard backs this phrase — the
  // "Видалити" action's target.
  readonly cardId!: string | null;

  readonly posts!: PhraseDictionaryPostDto[];
}
