import { Query } from '@nestjs/cqrs';
import type { DictionaryView } from './dictionary-view.js';

export class GetDictionaryQuery extends Query<DictionaryView> {
  constructor(readonly userId: string) {
    super();
  }
}
