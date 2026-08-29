import type { Doc } from '../../domain/node-tree.types.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import type { ExerciseSource } from '../../enums/exercise-source.enum.js';
import type { ExerciseType } from '../../enums/exercise-type.enum.js';

// Resolved lexicon entry for a `word` span. `wordId` (not `wordDefinitionId`)
// is the SRS card target for the inline "+" button (PLAN.md §2).
export interface WordAnnotationView {
  wordDefinitionId: string;
  wordId: string;
  lemma: string;
  pos: string;
  definition: string | null;
  phonetic: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  frequencyRank: number | null;
}

export interface PhraseAnnotationView {
  phraseId: string;
  text: string;
  type: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
}

export interface GrammarUsagePointView {
  grammarUsagePointId: string;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  exampleText: string | null;
}

// Resolved entry for a span's `grammarConstruct` slug. The inline tooltip
// shows the construction; the `/grammar/{slug}` page is where usage points get
// added to SRS.
export interface GrammarAnnotationView {
  slug: string;
  name: string;
  cefrLevel: CefrLevel | null;
  usagePoints: GrammarUsagePointView[];
}

export interface PostExerciseView {
  id: string;
  type: ExerciseType;
  source: ExerciseSource;
  payload: Record<string, unknown>;
}

export interface PostDetailView {
  shortId: string;
  slug: string | null;
  title: string | null;
  cefrLevel: CefrLevel | null;
  // ISO-8601.
  publishedAt: string;
  sourceLink: string | null;
  // The reassembled node tree (all PostParts in block order). The frontend
  // SSR-renders this to HTML with per-span classes (PLAN.md §6).
  doc: Doc;
  annotations: {
    // Keyed by wordDefinitionId (the id carried on a `word` span).
    words: Record<string, WordAnnotationView>;
    // Keyed by phraseId.
    phrases: Record<string, PhraseAnnotationView>;
    // Keyed by construction slug (the value of a span's `grammarConstruct`).
    grammar: Record<string, GrammarAnnotationView>;
  };
  exercises: PostExerciseView[];
}
