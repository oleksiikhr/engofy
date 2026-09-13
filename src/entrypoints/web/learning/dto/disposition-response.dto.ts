import type { Disposition } from '../../../../modules/learning/enums/disposition.enum.js';

export class DispositionResponseDto {
  readonly id!: string;

  readonly disposition!: Disposition;
}
