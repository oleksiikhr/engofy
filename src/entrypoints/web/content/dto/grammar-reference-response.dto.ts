import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class GrammarReferenceConstructionDto {
  readonly slug!: string;

  readonly name!: string;

  readonly cefrLevel!: CefrLevel | null;

  readonly usagePointCount!: number;
}

export class GrammarReferenceCategoryDto {
  readonly name!: string;

  readonly constructions!: GrammarReferenceConstructionDto[];
}

export class GrammarReferenceResponseDto {
  readonly categories!: GrammarReferenceCategoryDto[];
}
