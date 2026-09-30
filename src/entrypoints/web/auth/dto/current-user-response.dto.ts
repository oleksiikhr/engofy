import type { ContentLanguage } from '../../../../modules/post/enums/content-language.enum.js';

export class CurrentUserResponseDto {
  readonly id!: string;

  readonly email!: string;

  readonly nativeLang!: ContentLanguage;
}
