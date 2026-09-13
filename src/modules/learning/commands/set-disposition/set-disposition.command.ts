import { Command } from '@nestjs/cqrs';
import type { DispositionTargetInput } from '../../domain/disposition-target.js';
import type { Disposition } from '../../enums/disposition.enum.js';
import type { DispositionView } from '../../types/disposition-view.type.js';

export class SetDispositionCommand extends Command<DispositionView> {
  constructor(
    readonly userId: string,
    readonly target: DispositionTargetInput,
    readonly disposition: Disposition,
  ) {
    super();
  }
}
