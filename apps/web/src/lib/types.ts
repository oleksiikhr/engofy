// Mirrors the Nest read-API response DTOs (Slice 8a). Kept hand-written and
// minimal rather than generated — the surface is small and stable.

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// --- feed ---
export interface FeedItem {
  shortId: string;
  slug: string | null;
  title: string | null;
  cefrLevel: CefrLevel | null;
  publishedAt: string;
  excerpt: string;
  sourceLink: string | null;
}
export interface FeedResponse {
  items: FeedItem[];
  nextOffset: number | null;
}

// --- post detail (node tree + annotations) ---
export type Mark = 'bold' | 'italic';
export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}
export interface LinkNode {
  type: 'link';
  text: string;
  href: string;
  marks?: Mark[];
}
interface BaseSpanNode {
  type: 'span';
  text: string;
  marks?: Mark[];
  grammarConstruct?: string;
}
export interface WordSpanNode extends BaseSpanNode {
  kind: 'word';
  wordDefinitionId: string;
  pos: string;
}
export interface PhraseSpanNode extends BaseSpanNode {
  kind: 'phrase';
  phraseId: string;
}
export interface GrammarOnlySpanNode extends BaseSpanNode {
  kind: 'grammar_only';
}
export type SpanNode = WordSpanNode | PhraseSpanNode | GrammarOnlySpanNode;
export type InlineNode = TextNode | LinkNode | SpanNode;
export interface Paragraph {
  type: 'paragraph';
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}
export interface ListItem {
  children: InlineNode[];
}
export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}
export type Block = Paragraph | ListBlock;
export interface Doc {
  type: 'doc';
  children: Block[];
}

export interface WordAnnotation {
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
export interface PhraseAnnotation {
  phraseId: string;
  text: string;
  type: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
}
export interface GrammarUsagePointRef {
  grammarUsagePointId: string;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  exampleText: string | null;
}
export interface GrammarAnnotation {
  slug: string;
  name: string;
  cefrLevel: CefrLevel | null;
  usagePoints: GrammarUsagePointRef[];
}
export type ExerciseType =
  | 'fill_blank'
  | 'find_error'
  | 'multiple_choice'
  | 'comprehension'
  | 'reorder';
export interface PostExercise {
  id: string;
  type: ExerciseType;
  source: 'spacy' | 'ai';
  payload: Record<string, unknown>;
}
export interface PostDetail {
  shortId: string;
  slug: string | null;
  title: string | null;
  cefrLevel: CefrLevel | null;
  publishedAt: string;
  sourceLink: string | null;
  doc: Doc;
  annotations: {
    words: Record<string, WordAnnotation>;
    phrases: Record<string, PhraseAnnotation>;
    grammar: Record<string, GrammarAnnotation>;
  };
  exercises: PostExercise[];
}

// --- grammar reference ---
export interface GrammarRefConstruction {
  slug: string;
  name: string;
  cefrLevel: CefrLevel | null;
  usagePointCount: number;
}
export interface GrammarRefCategory {
  name: string;
  constructions: GrammarRefConstruction[];
}
export interface GrammarReference {
  categories: GrammarRefCategory[];
}
export interface GrammarConstructionDetail {
  slug: string;
  name: string;
  categoryName: string;
  cheatSheetContent: string | null;
  cefrLevel: CefrLevel | null;
  usagePoints: GrammarUsagePointRef[];
}

// --- dictionary ---
export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export interface DictionaryPostRef {
  shortId: string;
  slug: string | null;
  title: string | null;
}
export interface DictionaryEntry {
  cardId: string;
  type: 'word' | 'phrase';
  targetId: string;
  state: CardState;
  due: string;
  primary: string;
  secondary: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  posts: DictionaryPostRef[];
}
export interface DictionaryResponse {
  items: DictionaryEntry[];
}

// --- practice queue ---
export interface PracticeItem {
  cardId: string;
  state: CardState;
  due: string;
  target: {
    type: 'word' | 'phrase' | 'grammar';
    id: string;
    primary: string;
    secondary: string | null;
  };
}

// --- profile ---
export interface ProfileConstruction {
  slug: string;
  name: string;
  cefrLevel: CefrLevel | null;
  locked: boolean;
  masteryScore: number;
  correctStreak: number;
}
export interface ProfileCategory {
  name: string;
  constructions: ProfileConstruction[];
}
export interface Profile {
  streak: number;
  cefr: Record<CefrLevel, number>;
  categories: ProfileCategory[];
}

// --- auth / billing ---
export interface CurrentUser {
  id: string;
  email: string;
}
export interface Subscription {
  plan: 'free' | 'premium';
  // True while a premium period is running.
  active: boolean;
  currentPeriodEnd: string | null;
  isMockPayment: boolean;
}

export interface LearningCard {
  id: string;
  state: CardState;
  due: string;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
}
