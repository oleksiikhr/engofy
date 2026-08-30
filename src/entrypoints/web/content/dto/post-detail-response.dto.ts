import type { Doc } from '../../../../modules/post/domain/node-tree.types.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import type { ExerciseSource } from '../../../../modules/post/enums/exercise-source.enum.js';
import type { ExerciseType } from '../../../../modules/post/enums/exercise-type.enum.js';
import type {
  GrammarAnnotationView,
  PhraseAnnotationView,
  WordAnnotationView,
} from '../../../../modules/post/queries/get-post-detail/post-detail-view.js';

export class PostExerciseDto {
  readonly id!: string;

  readonly type!: ExerciseType;

  readonly source!: ExerciseSource;

  // Shape depends on `type` (see build-exercises.ts / comprehension-prompt.ts).
  readonly payload!: Record<string, unknown>;
}

export class PostAnnotationsDto {
  // Keyed by wordDefinitionId (the id on a `word` span).
  readonly words!: Record<string, WordAnnotationView>;

  // Keyed by phraseId.
  readonly phrases!: Record<string, PhraseAnnotationView>;

  // Keyed by construction slug (a span's `grammarConstruct`).
  readonly grammar!: Record<string, GrammarAnnotationView>;
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
