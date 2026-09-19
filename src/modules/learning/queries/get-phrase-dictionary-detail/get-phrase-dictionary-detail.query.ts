import { Query } from '@nestjs/cqrs';
import type { PhraseDictionaryDetailView } from './phrase-dictionary-detail-view.js';

export class GetPhraseDictionaryDetailQuery extends Query<PhraseDictionaryDetailView | null> {
  constructor(
    readonly phraseText: string,
    readonly userId: string,
  ) {
    super();
  }
}
