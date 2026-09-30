import { Query } from '@nestjs/cqrs';
import {
  type ContentLanguage,
  DEFAULT_CONTENT_LANGUAGE,
} from '../../../post/enums/content-language.enum.js';
import type { WordDictionaryDetailView } from './word-dictionary-detail-view.js';

export class GetWordDictionaryDetailQuery extends Query<WordDictionaryDetailView | null> {
  constructor(
    readonly lemma: string,
    readonly userId: string,
    readonly lang: ContentLanguage = DEFAULT_CONTENT_LANGUAGE,
  ) {
    super();
  }
}
