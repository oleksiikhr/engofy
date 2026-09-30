import { Command } from '@nestjs/cqrs';
import type { ContentLanguage } from '../../../post/enums/content-language.enum.js';

export class SetNativeLangCommand extends Command<ContentLanguage> {
  constructor(
    readonly userId: string,
    readonly nativeLang: ContentLanguage,
  ) {
    super();
  }
}
