import { Query } from '@nestjs/cqrs';
import type { EffectiveState } from '../../domain/resolve-effective-state.js';
import type { DictionaryView } from './dictionary-view.js';

export interface GetDictionaryOptions {
  // Restricts to one of the three states a dictionary entry can actually
  // have (`EffectiveState.New` never occurs here — see `dictionary-view.ts`).
  // Undefined = every state.
  state?: EffectiveState;
  // Case-insensitive substring match against lemma (word) / phraseText
  // (phrase) — not against definition/example.
  search?: string;
  cursor?: string;
  limit: number;
}

export class GetDictionaryQuery extends Query<DictionaryView> {
  constructor(
    readonly userId: string,
    readonly options: GetDictionaryOptions,
  ) {
    super();
  }
}
