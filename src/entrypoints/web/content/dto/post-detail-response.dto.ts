// `Doc` is the node-tree wire contract — a dependency-free data shape
// (`node-tree.types.ts` imports nothing) deliberately shared with the SSR
// renderer, not an internal query view. A type-only import of that leaf
// module is the intended coupling; re-declaring ~90 lines of recursive
// discriminated unions here would be fragile and produce a worse OpenAPI
// schema, so it stays referenced (REVIEW.md Batch N).
import type { Doc } from '../../../../modules/post/domain/node-tree.types.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import type { ExerciseSource } from '../../../../modules/post/enums/exercise-source.enum.js';
import type { ExerciseType } from '../../../../modules/post/enums/exercise-type.enum.js';

export class PostExerciseDto {
  readonly id!: string;

  readonly type!: ExerciseType;

  readonly source!: ExerciseSource;

  // Shape depends on `type` (see build-exercises.ts / comprehension-prompt.ts).
  readonly payload!: Record<string, unknown>;
}

export class PostWordAnnotationDto {
  readonly wordDefinitionId!: string;

  // The SRS card target for the inline "+" button (not `wordDefinitionId`).
  readonly wordId!: string;

  readonly lemma!: string;

  readonly pos!: string;

  readonly definition!: string | null;

  readonly phonetic!: string | null;

  readonly example!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  readonly frequencyRank!: number | null;
}

export class PostPhraseAnnotationDto {
  readonly phraseId!: string;

  readonly text!: string;

  readonly type!: string | null;

  readonly definition!: string | null;

  readonly example!: string | null;

  readonly cefrLevel!: CefrLevel | null;
}

export class PostGrammarUsagePointDto {
  readonly grammarUsagePointId!: string;

  readonly cefrLevel!: CefrLevel;

  readonly guideword!: string;

  readonly canDoStatement!: string;

  readonly exampleText!: string | null;
}

export class PostGrammarAnnotationDto {
  readonly slug!: string;

  readonly name!: string;

  readonly cefrLevel!: CefrLevel | null;

  readonly usagePoints!: PostGrammarUsagePointDto[];
}

export class PostAnnotationsDto {
  // Keyed by wordDefinitionId (the id on a `word` span).
  readonly words!: Record<string, PostWordAnnotationDto>;

  // Keyed by phraseId.
  readonly phrases!: Record<string, PostPhraseAnnotationDto>;

  // Keyed by construction slug (a span's `grammarConstruct`).
  readonly grammar!: Record<string, PostGrammarAnnotationDto>;
}

export class PostDetailResponseDto {
  readonly shortId!: string;

  readonly slug!: string | null;

  readonly title!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  // ISO-8601.
  readonly publishedAt!: string;

  // Human-readable source credit (PLAN.md §9); always set.
  readonly attributionText!: string;

  // `original` | `excerpt` | `reddit_comment` | `news_snippet`.
  readonly sourceType!: string;

  readonly sourceLink!: string | null;

  // Reassembled node tree; the frontend SSR-renders it with per-span classes.
  readonly doc!: Doc;

  readonly annotations!: PostAnnotationsDto;

  readonly exercises!: PostExerciseDto[];
}
