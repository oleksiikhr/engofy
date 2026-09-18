import type { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import type { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';

export class WordDictionarySenseDto {
  readonly wordDefinitionId!: string;

  readonly pos!: PartOfSpeech;

  readonly definition!: string | null;

  readonly phonetic!: string | null;

  readonly example!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  readonly state!: EffectiveState;

  // Non-null only when an active LearningCard backs this sense — the
  // "Видалити" action's target.
  readonly cardId!: string | null;
}

export class WordDictionaryPostDto {
  readonly shortId!: string;

  readonly slug!: string | null;

  readonly title!: string | null;

  readonly isRead!: boolean;
}

export class WordDictionaryIrregularFormsDto {
  readonly pastSimple!: string[];

  readonly pastParticiple!: string[];
}

export class WordDictionaryDetailResponseDto {
  readonly lemma!: string;

  readonly frequencyRank!: number | null;

  readonly irregularVerb!: WordDictionaryIrregularFormsDto | null;

  readonly senses!: WordDictionarySenseDto[];

  readonly posts!: WordDictionaryPostDto[];
}
