import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';

const SetCefrLevelSchema = z.object({
  cefrLevel: z.enum(CefrLevel),
});

export class SetCefrLevelDto extends createZodDto(SetCefrLevelSchema) {}
