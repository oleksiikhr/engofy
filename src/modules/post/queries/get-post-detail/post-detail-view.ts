import type { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import type {
  IrregularVerbForms,
  TokenTense,
} from '../../domain/analyze-token.js';
import type { Doc } from '../../domain/node-tree.types.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import type { ExerciseSource } from '../../enums/exercise-source.enum.js';
import type { ExerciseType } from '../../enums/exercise-type.enum.js';

// Resolved lexicon entry for a `word` span. `wordDefinitionId` (one POS sense,
// not the whole word) is the SRS card target for the inline "+" button
// (PLAN.md §2); `wordId` is only the underlying lexeme, for display. `state`
// is the viewer's effective state for this sense (a guest is always `New`);
// it decides whether the reader marks the span at all.
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
  state: EffectiveState;
}

export interface PhraseAnnotationView {
  phraseId: string;
  text: string;
  type: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
}

export interface GrammarUsagePointView {
  grammarUsagePointId: string;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  explanation: string | null;
  examples: string[];
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

// One grammar_matches row placed on the doc: a usage point detected in a
// sentence, resolved to a char range in its block's flattened unit text (the
// coordinate system of the node tree's text nodes). `state` is the viewer's
// effective state for the usage point; the reader labels only new/learning.
export interface GrammarMatchView {
  // Index within Doc.children.
  blockIndex: number;
  // Index within a ListBlock's items; null for a paragraph.
  itemIndex: number | null;
  // Half-open char range within the unit's plain text.
  charStart: number;
  charEnd: number;
  grammarUsagePointId: string;
  state: EffectiveState;
}

// One spaCy token placed on the doc (same block/unit/char coordinates as a
// GrammarMatchView). Punctuation and whitespace tokens are left out. `pos` is
// the raw spaCy UPOS tag; `tense` is set on finite verbs and `will`;
// `irregular` on a verb in an irregular past form.
export interface TokenView {
  blockIndex: number;
  itemIndex: number | null;
  charStart: number;
  charEnd: number;
  pos: string;
  tense: TokenTense | null;
  irregular: IrregularVerbForms | null;
}

export interface PostExerciseView {
  id: string;
  type: ExerciseType;
  source: ExerciseSource;
  payload: Record<string, unknown>;
  // Position in Doc.children of the block the exercise's sentence sits in;
  // absent when the sentence is gone.
  blockIndex?: number;
}

export interface PostDetailView {
  shortId: string;
  slug: string | null;
  title: string | null;
  cefrLevel: CefrLevel | null;
  // ISO-8601.
  publishedAt: string;
  // Source attribution (PLAN.md §9). `attributionText` is always set; the link
  // is null when the text is original / has no url.
  attributionText: string;
  sourceType: string;
  sourceLink: string | null;
  // Whether the viewer marked the post read; always false for a guest.
  isRead: boolean;
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
    // Sorted by position in the doc.
    grammarMatches: GrammarMatchView[];
    // Sorted by position in the doc.
    tokens: TokenView[];
  };
  exercises: PostExerciseView[];
}
