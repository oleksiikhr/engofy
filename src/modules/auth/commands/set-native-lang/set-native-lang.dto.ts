import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ContentLanguage } from '../../../post/enums/content-language.enum.js';

const SetNativeLangSchema = z.object({
  nativeLang: z.enum(ContentLanguage),
});

export class SetNativeLangDto extends createZodDto(SetNativeLangSchema) {}
