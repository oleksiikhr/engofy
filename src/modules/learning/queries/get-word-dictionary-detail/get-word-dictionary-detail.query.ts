import { Query } from '@nestjs/cqrs';
import type { WordDictionaryDetailView } from './word-dictionary-detail-view.js';

export class GetWordDictionaryDetailQuery extends Query<WordDictionaryDetailView | null> {
  constructor(
    readonly lemma: string,
    readonly userId: string,
  ) {
    super();
  }
}
