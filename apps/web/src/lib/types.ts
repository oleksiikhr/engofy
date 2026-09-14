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
export interface DueCardCountResponse {
  dueCount: number;
}
export interface StreakResponse {
  streak: number;
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
  quote?: boolean;
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
// --- reader sidebar ("In this article", PLAN.md §16/§17 Track B) ---
// `CardState` is declared below (dictionary section) — TS type aliases don't
// care about declaration order within a module.
export interface SidebarWordEntry {
  wordDefinitionId: string;
  lemma: string;
  state: CardState;
}
export interface SidebarPhraseEntry {
  phraseId: string;
  text: string;
  state: CardState;
}
export interface SidebarGrammarEntry {
  slug: string;
  name: string;
  state: CardState;
}
export interface PostSidebar {
  grammar: SidebarGrammarEntry[];
  words: SidebarWordEntry[];
  phrases: SidebarPhraseEntry[];
}

export interface PostDetail {
  shortId: string;
  slug: string | null;
  title: string | null;
  cefrLevel: CefrLevel | null;
  publishedAt: string;
  sourceLink: string | null;
  sourceType: string;
  attributionText: string;
  doc: Doc;
  annotations: {
    words: Record<string, WordAnnotation>;
    phrases: Record<string, PhraseAnnotation>;
    grammar: Record<string, GrammarAnnotation>;
  };
  exercises: PostExercise[];
  sidebar: PostSidebar;
}

// --- grammar reference ---
// The learner-facing 4-state model (learning-foundation §2), distinct from
// the raw FSRS `CardState` below — richer than "has a card or not".
export type EffectiveState = 'new' | 'learning' | 'learned' | 'skipped';
export interface GrammarRefConstruction {
  slug: string;
  name: string;
  cefrLevel: CefrLevel | null;
  usagePointCount: number;
  state: EffectiveState;
}
export interface GrammarRefCategory {
  name: string;
  constructions: GrammarRefConstruction[];
}
export interface GrammarReference {
  categories: GrammarRefCategory[];
}
export interface GrammarConstructionUsagePoint extends GrammarUsagePointRef {
  state: EffectiveState;
}
export interface GrammarConstructionDetail {
  slug: string;
  name: string;
  categoryName: string;
  cheatSheetContent: string | null;
  cefrLevel: CefrLevel | null;
  usagePoints: GrammarConstructionUsagePoint[];
}

// --- dictionary ---
export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export interface DictionaryPostRef {
  shortId: string;
  slug: string | null;
  title: string | null;
}
export interface DictionaryEntry {
  type: 'word' | 'phrase';
  // Headword: word lemma or phrase text — also the `/dictionary/words/...`
  // `/dictionary/phrases/...` route param.
  primary: string;
  // `EffectiveState` above; `new` never appears here — every dictionary
  // entry already has a card or a disposition behind it (see `GetDictionaryHandler`).
  state: EffectiveState;
  // How many distinct saved senses of this lemma matched the current filter.
  // Always 1 for a phrase.
  senseCount: number;
  secondary: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  posts: DictionaryPostRef[];
}
export interface DictionaryResponse {
  items: DictionaryEntry[];
  nextCursor: string | null;
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
    phonetic: string | null;
    contextSentence: string | null;
  };
}
export interface PracticeQueueResponse {
  items: PracticeItem[];
  // Always null — the queue is capped at `?limit=` with no offset param.
  // Present for shape parity with the other list endpoints.
  nextOffset: number | null;
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
// The light `/profile` hub response (profile-hub-redesign slice 1) — not the
// full `Profile` above, which is `/profile/progress`.
export interface ProfileHub {
  streak: number;
  cefrLevel: CefrLevel;
}

// --- daily session (home) ---
export interface DailyPlan {
  postShortId: string;
  postSlug: string | null;
  postTitle: string | null;
  postCefrLevel: CefrLevel | null;
  isRead: boolean;
  grammarUsagePointId: string | null;
  grammarGuideword: string | null;
  grammarConstructionSlug: string | null;
  grammarCanDoStatement: string | null;
  grammarExampleText: string | null;
  completedAt: string | null;
}
export interface CompleteDailyPlanResponse {
  completedAt: string;
  newCardsToday: number;
  reviewsToday: number;
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
