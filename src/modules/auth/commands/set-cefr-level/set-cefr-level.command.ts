import { Command } from '@nestjs/cqrs';
import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';

export class SetCefrLevelCommand extends Command<CefrLevel> {
  constructor(
    readonly userId: string,
    readonly cefrLevel: CefrLevel,
  ) {
    super();
  }
}
