import { Query } from '@nestjs/cqrs';
import type { ContentLanguage } from '../../../post/enums/content-language.enum.js';

export class ResolveNativeLangQuery extends Query<ContentLanguage> {
  constructor(
    readonly userId: string | null,
    readonly cookieValue: string | undefined,
  ) {
    super();
  }
}
