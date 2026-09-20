// Mirrors the Nest read-API response DTOs (Slice 8a). Kept hand-written and
// minimal rather than generated — the surface is small and stable.

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// --- posts archive (/posts) ---
export interface PostsListItem {
  shortId: string;
  slug: string | null;
  title: string | null;
  cefrLevel: CefrLevel | null;
  publishedAt: string;
  excerpt: string;
  sourceLink: string | null;
  attributionText: string;
  sourceType: string;
  isRead: boolean;
}
export interface PostsListResponse {
  items: PostsListItem[];
  nextCursor: string | null;
}
export interface PostSuggestion {
  type: 'word' | 'phrase';
  text: string;
}
export interface PostSuggestionsResponse {
  items: PostSuggestion[];
}
export interface DueCardCountResponse {
  dueCount: number;
}
export interface NewCardBudgetResponse {
  // New cards the learner may still add today.
  remaining: number;
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
  // Set client-side by `applyGrammarMatches`; never present on the wire.
  grammarUsagePointId?: string;
}
export interface LinkNode {
  type: 'link';
  text: string;
  href: string;
  marks?: Mark[];
  grammarUsagePointId?: string;
}
interface BaseSpanNode {
  type: 'span';
  text: string;
  marks?: Mark[];
  grammarConstruct?: string;
  grammarUsagePointId?: string;
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
  // The viewer's effective state for this sense; `new` for a guest.
  state: EffectiveState;
}
export interface PhraseAnnotation {
  phraseId: string;
  text: string;
  type: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
}
export interface GrammarUsagePointRef {
  grammarUsagePointId: string;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  // Learner-facing explanation and clean example sentences; null / empty
  // until the backend's grammar enrichment has covered this point.
  explanation: string | null;
  examples: string[];
}
export interface GrammarAnnotation {
  slug: string;
  name: string;
  cefrLevel: CefrLevel | null;
  usagePoints: GrammarUsagePointRef[];
}
// A grammar usage point placed on the doc: `charStart`/`charEnd` is a
// half-open range in the plain text of the block unit (`itemIndex` picks the
// list item, null for a paragraph).
export interface GrammarMatch {
  blockIndex: number;
  itemIndex: number | null;
  charStart: number;
  charEnd: number;
  grammarUsagePointId: string;
  state: EffectiveState;
}
export type TokenTense = 'past' | 'present' | 'future';
// A content token (no punctuation) of the post's spaCy layer, in the same
// block/unit/char coordinates as a GrammarMatch.
export interface ReaderToken {
  blockIndex: number;
  itemIndex: number | null;
  charStart: number;
  charEnd: number;
  // Raw spaCy UPOS tag.
  pos: string;
  tense: TokenTense | null;
  irregular: {
    base: string;
    pastSimple: string[];
    pastParticiple: string[];
  } | null;
}
export type ExerciseType =
  | 'fill_blank'
  | 'find_error'
  | 'multiple_choice'
  | 'grammar_contrastive'
  | 'reorder';
export interface PostExercise {
  id: string;
  type: ExerciseType;
  source: 'spacy' | 'ai';
  payload: Record<string, unknown>;
  // Index in `doc.children` of the block the exercise is about. Absent on an
  // API still on the previous release.
  blockIndex?: number;
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
  // Absent from an API still on the previous release.
  isRead?: boolean;
  doc: Doc;
  annotations: {
    words: Record<string, WordAnnotation>;
    phrases: Record<string, PhraseAnnotation>;
    grammar: Record<string, GrammarAnnotation>;
    grammarMatches: GrammarMatch[];
    // Absent from an API still on the previous release.
    tokens?: ReaderToken[];
  };
  exercises: PostExercise[];
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
  // Learner explanation of the construction's easiest usage point.
  summary: string | null;
  state: EffectiveState;
  // Usage points the learner resolved (learned or skipped); absent for a guest.
  learnedCount?: number;
}
export interface GrammarRefGroup {
  // Stable id within the axis: category name, `past`/`present`/`future`/`other`
  // or a CEFR level.
  key: string;
  name: string;
  constructions: GrammarRefConstruction[];
}
export interface GrammarReference {
  groups: GrammarRefGroup[];
}
export interface GrammarConstructionUsagePoint extends GrammarUsagePointRef {
  state: EffectiveState;
  // Untouched but at or below the learner's own level.
  assumedKnown: boolean;
}
export interface GrammarLevelProgress {
  cefrLevel: CefrLevel;
  learnedCount: number;
  totalCount: number;
}
export interface GrammarConstructionDetail {
  slug: string;
  name: string;
  categoryName: string;
  cheatSheetContent: string | null;
  cefrLevel: CefrLevel | null;
  usagePoints: GrammarConstructionUsagePoint[];
  // Easiest level first; absent for a guest.
  levelProgress?: GrammarLevelProgress[];
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

// --- dictionary word detail (/dictionary/words/[lemma]) ---
export interface WordDictionarySense {
  wordDefinitionId: string;
  pos: string;
  definition: string | null;
  phonetic: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
  // Non-null only when an active LearningCard backs this sense — needed by
  // the "Remove" action (`DELETE /learning/cards/:cardId`).
  cardId: string | null;
}
export interface WordDictionaryPost {
  shortId: string;
  slug: string | null;
  title: string | null;
  isRead: boolean;
}
export interface WordDictionaryIrregularForms {
  pastSimple: string[];
  pastParticiple: string[];
}
export interface WordDictionaryDetail {
  lemma: string;
  frequencyRank: number | null;
  irregularVerb: WordDictionaryIrregularForms | null;
  senses: WordDictionarySense[];
  posts: WordDictionaryPost[];
}

// --- dictionary phrase detail (/dictionary/phrases/[phrase]) ---
export interface PhraseDictionaryPost {
  shortId: string;
  slug: string | null;
  title: string | null;
  isRead: boolean;
}
export interface PhraseDictionaryDetail {
  phraseId: string;
  phraseText: string;
  type: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
  // Non-null only when an active LearningCard backs this phrase — needed by
  // the "Remove" action (`DELETE /learning/cards/:cardId`).
  cardId: string | null;
  posts: PhraseDictionaryPost[];
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
    // Grammar-only (null for word/phrase).
    kicker: string | null;
    exampleText: string | null;
    detailSlug: string | null;
  };
}
export interface PracticeQueueResponse {
  items: PracticeItem[];
  // Always null — the queue is capped at `?limit=` with no offset param.
  // Present for shape parity with the other list endpoints.
  nextOffset: number | null;
  // How many New-state cards the daily new-card cap held back (0 when
  // nothing was held back, or the cap was bypassed for this request).
  heldBackNewCount: number;
  // Whether the user owns any non-archived card at all (ignores the type
  // filter and what's due) — "no cards yet" vs "queue cleared".
  hasAnyCards: boolean;
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
  // Every UTC day (`YYYY-MM-DD`, ascending) with at least one review.
  activityDays: string[];
  cefr: Record<CefrLevel, number>;
  categories: ProfileCategory[];
}
// The light `/profile` hub response (profile-hub-redesign slice 1) — not the
// full `Profile` above, which is `/profile/progress`.
export interface ProfileHub {
  streak: number;
  cefrLevel: CefrLevel;
  accountDeletion: AccountDeletion | null;
  // ISO timestamp once today's daily session is done, else null.
  dailyPlanCompletedAt: string | null;
}
// Pending account-deletion request (ISO-8601 timestamps).
export interface AccountDeletion {
  requestedAt: string;
  scheduledFor: string;
}
// `GET /profile/subscription`; `cardLimit` is null on premium (unlimited).
export interface ProfileSubscription {
  plan: 'free' | 'premium';
  active: boolean;
  currentPeriodEnd: string | null;
  cardsUsed: number;
  cardLimit: number | null;
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
export interface DispositionResponse {
  id: string;
  disposition: 'known' | 'skipped';
}

export interface PostsSitemapIndex {
  // `page` is 1-based, as `GET /content/sitemap/posts/:page` expects.
  pages: { page: number; lastmod: string }[];
}
export interface PostsSitemapPage {
  items: { slug: string | null; shortId: string; lastmod: string }[];
}
