import { Query } from '@nestjs/cqrs';
import {
  type ContentLanguage,
  DEFAULT_CONTENT_LANGUAGE,
} from '../../../post/enums/content-language.enum.js';
import type { PhraseDictionaryDetailView } from './phrase-dictionary-detail-view.js';

export class GetPhraseDictionaryDetailQuery extends Query<PhraseDictionaryDetailView | null> {
  constructor(
    readonly phraseText: string,
    readonly userId: string,
    readonly lang: ContentLanguage = DEFAULT_CONTENT_LANGUAGE,
  ) {
    super();
  }
}
