import type { EntityManager } from '@mikro-orm/core';
import { Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { SubCommand } from 'nest-commander';
import type {
  Node,
  Paragraph,
  SpanKind,
} from '../../../modules/post/domain/node-tree.types.js';
import { Exercise } from '../../../modules/post/entities/exercise.entity.js';
import { GrammarCategory } from '../../../modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../modules/post/entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../../modules/post/entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../../modules/post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../modules/post/entities/phrase.entity.js';
import { Post } from '../../../modules/post/entities/post.entity.js';
import { PostPart } from '../../../modules/post/entities/post-part.entity.js';
import { Sentence } from '../../../modules/post/entities/sentence.entity.js';
import { SentenceToken } from '../../../modules/post/entities/sentence-token.entity.js';
import { Word } from '../../../modules/post/entities/word.entity.js';
import { WordDefinition } from '../../../modules/post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../modules/post/enums/cefr-level.enum.js';
import { ExerciseSource } from '../../../modules/post/enums/exercise-source.enum.js';
import { ExerciseType } from '../../../modules/post/enums/exercise-type.enum.js';
import { PartOfSpeech } from '../../../modules/post/enums/part-of-speech.enum.js';
import { PhraseType } from '../../../modules/post/enums/phrase-type.enum.js';
import { PostPartKind } from '../../../modules/post/enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../../modules/post/enums/post-source-format.enum.js';
import { PostSourceType } from '../../../modules/post/enums/post-source-type.enum.js';
import { PostStatus } from '../../../modules/post/enums/post-status.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';

// Reader-page fixtures for manual QA of word-types/tenses/analyze/grammar/
// exercises (reader-token-analysis-unify plan, slice 5). Hand-built, exactly
// like test/e2e/seed-web-e2e.ts, but on the dev DB and reachable as a CLI
// subcommand rather than the isolated Playwright fixture path. No spaCy/AI
// calls: every SentenceToken below is authored directly with the pos/tag/dep/
// headPosition/morph combination that drives analyze-token.ts's tense+aspect
// detector and word-role-fallback.ts's POS role map, so the fixtures exercise
// the real deterministic logic rather than a simplified stand-in.

const POST_SHORT_IDS = [
  'DevSeedA1',
  'DevSeedA2',
  'DevSeedB1',
  'DevSeedB2',
] as const;
const GRAMMAR_CATEGORY_NAME = 'Dev Seed: Reader Coverage';

// --- token/sentence builder -------------------------------------------------

interface TokenSpec {
  text: string;
  pos: string;
  tag: string;
  lemma?: string;
  dep?: string;
  headPosition?: number | null;
  morph?: Record<string, string>;
  wordId?: string;
  phraseId?: string;
  isIdiomPart?: boolean;
}

interface BuiltToken {
  position: number;
  text: string;
  lemma: string;
  pos: string;
  tag: string;
  dep: string;
  headPosition: number | null;
  morph: Record<string, string>;
  charStart: number;
  charEnd: number;
  wordId?: string;
  phraseId?: string;
  isIdiomPart: boolean;
}

// Joins tokens with a single space, except before punctuation — and hands
// back each token's char offsets within the resulting text, so a sentence's
// tokens never have to be offset-counted by hand.
function buildTokens(specs: TokenSpec[]): {
  rawText: string;
  tokens: BuiltToken[];
} {
  let cursor = 0;
  let rawText = '';
  const tokens: BuiltToken[] = specs.map((spec, position) => {
    if (position > 0 && spec.pos !== 'PUNCT') {
      rawText += ' ';
      cursor += 1;
    }
    const charStart = cursor;
    rawText += spec.text;
    cursor += spec.text.length;
    return {
      position,
      text: spec.text,
      lemma: spec.lemma ?? spec.text.toLowerCase(),
      pos: spec.pos,
      tag: spec.tag,
      dep: spec.dep ?? 'dep',
      headPosition: spec.headPosition ?? null,
      morph: spec.morph ?? {},
      charStart,
      charEnd: cursor,
      wordId: spec.wordId,
      phraseId: spec.phraseId,
      isIdiomPart: spec.isIdiomPart ?? false,
    };
  });
  return { rawText, tokens };
}

interface SpanSpec {
  // Contiguous BuiltToken positions this span wraps.
  tokenPositions: number[];
  kind: SpanKind;
  wordDefinitionId?: string;
  posLabel?: string;
  phraseId?: string;
  grammarConstruct?: string;
}

// Slices the already-built rawText around each span's token range, so the
// paragraph's flattened text (word-for-word concatenation of its children)
// stays byte-identical to the Sentence.rawText the tokens were offset against
// — the invariant locateSentenceTokens relies on to line up the two layers.
function buildParagraph(
  rawText: string,
  tokens: BuiltToken[],
  spans: SpanSpec[],
): Paragraph {
  const sorted = [...spans].sort(
    (a, b) =>
      tokens[a.tokenPositions[0]].charStart -
      tokens[b.tokenPositions[0]].charStart,
  );
  const children: Node[] = [];
  let cursor = 0;
  for (const span of sorted) {
    const first = tokens[span.tokenPositions[0]];
    const last = tokens[span.tokenPositions[span.tokenPositions.length - 1]];
    if (first.charStart > cursor) {
      children.push({
        type: 'text',
        text: rawText.slice(cursor, first.charStart),
      });
    }
    const text = rawText.slice(first.charStart, last.charEnd);
    if (span.kind === 'word') {
      children.push({
        type: 'span',
        kind: 'word',
        text,
        wordDefinitionId: span.wordDefinitionId as string,
        pos: span.posLabel as string,
      });
    } else if (span.kind === 'phrase') {
      children.push({
        type: 'span',
        kind: 'phrase',
        text,
        phraseId: span.phraseId as string,
      });
    } else {
      children.push({
        type: 'span',
        kind: 'grammar_only',
        text,
        grammarConstruct: span.grammarConstruct as string,
      });
    }
    cursor = last.charEnd;
  }
  if (cursor < rawText.length) {
    children.push({ type: 'text', text: rawText.slice(cursor) });
  }
  return { type: 'paragraph', children };
}

interface SentenceUnit {
  postPart: PostPart;
  sentence: Sentence;
  tokens: BuiltToken[];
}

function createSentenceUnit(
  em: EntityManager,
  post: Post,
  blockIndex: number,
  specs: TokenSpec[],
  spans: SpanSpec[] = [],
): SentenceUnit {
  const { rawText, tokens } = buildTokens(specs);
  const now = DateTime.now();

  const postPart = new PostPart();
  postPart.postId = post.id;
  postPart.blockIndex = blockIndex;
  postPart.kind = PostPartKind.Paragraph;
  postPart.body = buildParagraph(rawText, tokens, spans);
  postPart.annotatedAt = now;
  em.persist(postPart);

  const sentence = new Sentence();
  sentence.postId = post.id;
  sentence.postPartId = postPart.id;
  sentence.unitIndex = 0;
  sentence.position = 0;
  sentence.rawText = rawText;
  sentence.charStart = 0;
  sentence.charEnd = rawText.length;
  em.persist(sentence);

  for (const token of tokens) {
    const sentenceToken = new SentenceToken();
    sentenceToken.sentenceId = sentence.id;
    sentenceToken.position = token.position;
    sentenceToken.text = token.text;
    sentenceToken.charStart = token.charStart;
    sentenceToken.charEnd = token.charEnd;
    sentenceToken.lemma = token.lemma;
    sentenceToken.pos = token.pos;
    sentenceToken.tag = token.tag;
    sentenceToken.dep = token.dep;
    sentenceToken.headPosition = token.headPosition;
    sentenceToken.morph = token.morph;
    sentenceToken.isIdiomPart = token.isIdiomPart;
    if (token.wordId) {
      sentenceToken.wordId = token.wordId;
    }
    if (token.phraseId) {
      sentenceToken.phraseId = token.phraseId;
    }
    em.persist(sentenceToken);
  }

  return { postPart, sentence, tokens };
}

function addGrammarMatch(
  em: EntityManager,
  sentenceId: string,
  usagePointId: string,
  tokenStart: number,
  tokenEnd: number,
): void {
  const match = new GrammarMatch();
  match.sentenceId = sentenceId;
  match.grammarUsagePointId = usagePointId;
  match.tokenStart = tokenStart;
  match.tokenEnd = tokenEnd;
  em.persist(match);
}

function addExercise(
  em: EntityManager,
  postId: string,
  type: ExerciseType,
  source: ExerciseSource,
  payload: Record<string, unknown>,
): void {
  const exercise = new Exercise();
  exercise.postId = postId;
  exercise.type = type;
  exercise.source = source;
  exercise.payload = payload;
  em.persist(exercise);
}

async function findOrCreateWord(
  em: EntityManager,
  lemma: string,
): Promise<Word> {
  const existing = await em.findOne(Word, { lemma });
  if (existing) {
    return existing;
  }
  const word = new Word();
  word.lemma = lemma;
  em.persist(word);
  return word;
}

async function findOrCreateWordDefinition(
  em: EntityManager,
  wordId: string,
  pos: PartOfSpeech,
  data: {
    definition: string;
    exampleSentence: string;
    cefrLevel?: CefrLevel;
  },
): Promise<WordDefinition> {
  const existing = await em.findOne(WordDefinition, { wordId, pos });
  if (existing) {
    return existing;
  }
  const definition = new WordDefinition();
  definition.wordId = wordId;
  definition.pos = pos;
  definition.definition = data.definition;
  definition.exampleSentence = data.exampleSentence;
  definition.cefrLevel = data.cefrLevel ?? null;
  em.persist(definition);
  return definition;
}

async function findOrCreatePhrase(
  em: EntityManager,
  phraseText: string,
  data: {
    type: PhraseType;
    definition: string;
    exampleSentence: string;
    cefrLevel: CefrLevel;
  },
): Promise<Phrase> {
  const existing = await em.findOne(Phrase, { phraseText });
  if (existing) {
    return existing;
  }
  const phrase = new Phrase();
  phrase.phraseText = phraseText;
  phrase.type = data.type;
  phrase.definition = data.definition;
  phrase.exampleSentence = data.exampleSentence;
  phrase.cefrLevel = data.cefrLevel;
  em.persist(phrase);
  return phrase;
}

function createPost(
  shortId: string,
  title: string,
  slug: string,
  cefrLevel: CefrLevel,
  publishedAt: DateTime,
): Post {
  const post = new Post();
  post.shortId = shortId;
  post.title = title;
  post.slug = slug;
  post.status = PostStatus.Published;
  post.cefrLevel = cefrLevel;
  post.publishedAt = publishedAt;
  post.contentUpdatedAt = publishedAt;
  post.source = {
    format: PostSourceFormat.Text,
    type: PostSourceType.Original,
    rawText: '',
    link: null,
    attributionText: 'Dev-seed fixture — not real content',
  };
  return post;
}

// --- wipe --------------------------------------------------------------

// Only deletes rows this command owns outright (fixed shortIds / the fixed
// grammar category name). Word/WordDefinition/Phrase rows are found-or-
// created instead of wiped — a dev DB may already hold real ingested content
// under the same lemma/phrase text, and this command must never delete data
// it didn't create.
async function wipe(em: EntityManager): Promise<void> {
  const posts = await em.find(Post, { shortId: { $in: [...POST_SHORT_IDS] } });
  const postIds = posts.map((p) => p.id);
  const parts = await em.find(PostPart, { postId: { $in: postIds } });
  const partIds = parts.map((p) => p.id);
  const sentences = await em.find(Sentence, { postPartId: { $in: partIds } });
  const sentenceIds = sentences.map((s) => s.id);

  await em.nativeDelete(GrammarMatch, { sentenceId: { $in: sentenceIds } });
  await em.nativeDelete(SentenceToken, { sentenceId: { $in: sentenceIds } });
  await em.nativeDelete(Sentence, { id: { $in: sentenceIds } });
  await em.nativeDelete(Exercise, { postId: { $in: postIds } });
  await em.nativeDelete(PostPart, { id: { $in: partIds } });
  await em.nativeDelete(Post, { id: { $in: postIds } });

  const category = await em.findOne(GrammarCategory, {
    name: GRAMMAR_CATEGORY_NAME,
  });
  if (category) {
    const constructions = await em.find(GrammarConstruction, {
      categoryId: category.id,
    });
    const constructionIds = constructions.map((c) => c.id);
    await em.nativeDelete(GrammarUsagePoint, {
      constructionId: { $in: constructionIds },
    });
    await em.nativeDelete(GrammarConstruction, {
      id: { $in: constructionIds },
    });
    await em.nativeDelete(GrammarCategory, { id: category.id });
  }
}

// --- seed ----------------------------------------------------------------

interface SeedSummary {
  posts: number;
  sentences: number;
  tokens: number;
  exercises: number;
}

async function seed(em: EntityManager): Promise<SeedSummary> {
  const now = DateTime.now();
  let sentenceCount = 0;
  let tokenCount = 0;
  let exerciseCount = 0;

  // --- lexicon: one dictionary-backed word per content POS group, plus one
  // idiom — deliberately uncommon words so they never collide with a real
  // lemma a dev already ingested. ---
  const lopsidedWord = await findOrCreateWord(em, 'lopsided');
  const lopsidedDef = await findOrCreateWordDefinition(
    em,
    lopsidedWord.id,
    PartOfSpeech.Adjective,
    {
      definition: 'not even or balanced on both sides',
      exampleSentence: 'The lopsided gazebo leaned to one side.',
      cefrLevel: CefrLevel.B1,
    },
  );
  const gazeboWord = await findOrCreateWord(em, 'gazebo');
  const gazeboDef = await findOrCreateWordDefinition(
    em,
    gazeboWord.id,
    PartOfSpeech.Noun,
    {
      definition: 'a small roofed structure in a garden or park',
      exampleSentence: 'They had tea in the gazebo.',
      cefrLevel: CefrLevel.B2,
    },
  );
  const begrudginglyWord = await findOrCreateWord(em, 'begrudgingly');
  const begrudginglyDef = await findOrCreateWordDefinition(
    em,
    begrudginglyWord.id,
    PartOfSpeech.Adverb,
    {
      definition: 'in a way that shows reluctance or resentment',
      exampleSentence: 'He begrudgingly agreed to help.',
      cefrLevel: CefrLevel.C1,
    },
  );
  const meanderWord = await findOrCreateWord(em, 'meander');
  const meanderDef = await findOrCreateWordDefinition(
    em,
    meanderWord.id,
    PartOfSpeech.Verb,
    {
      definition: 'to walk slowly, without hurrying or a fixed direction',
      exampleSentence: 'The path meanders through the old town.',
      cefrLevel: CefrLevel.B2,
    },
  );
  const breakTheIcePhrase = await findOrCreatePhrase(em, 'break the ice', {
    type: PhraseType.Idiom,
    definition: 'to make people feel more relaxed in a social situation',
    exampleSentence: 'He told a joke to break the ice.',
    cefrLevel: CefrLevel.B1,
  });

  // --- grammar reference: a few usage points of our own, never colliding
  // with the real EGP import (`grammar import-egp`), which never uses this
  // category name or these slugs. ---
  const category = new GrammarCategory();
  category.name = GRAMMAR_CATEGORY_NAME;
  category.sortOrder = 950;
  em.persist(category);

  const pastPerfectConstruction = new GrammarConstruction();
  pastPerfectConstruction.categoryId = category.id;
  pastPerfectConstruction.name = 'past perfect';
  pastPerfectConstruction.slug = 'devseed-past-perfect';
  pastPerfectConstruction.cheatSheetContent =
    '## Form\n\n`had` + past participle.';
  pastPerfectConstruction.sortOrder = 1;
  em.persist(pastPerfectConstruction);

  const pastPerfectUp = new GrammarUsagePoint();
  pastPerfectUp.constructionId = pastPerfectConstruction.id;
  pastPerfectUp.egpIndex = 91001;
  pastPerfectUp.cefrLevel = CefrLevel.B1;
  pastPerfectUp.guideword = 'USE: EARLIER PAST';
  pastPerfectUp.canDoStatement =
    'Can show that one past action happened before another past action.';
  pastPerfectUp.exampleText = 'By evening, she had walked ten miles.';
  pastPerfectUp.learnerExplanation =
    'We use the past perfect to show which of two past actions happened first. It is formed with had + past participle.';
  pastPerfectUp.learnerExamples = [
    'She had walked ten miles by evening.',
    'They had left before we arrived.',
  ];
  pastPerfectUp.translations = {
    uk: {
      explanation:
        'Past perfect показує, яка з двох минулих дій сталася раніше. Утворюється за схемою had + past participle.',
    },
  };
  em.persist(pastPerfectUp);

  const goingToFutureConstruction = new GrammarConstruction();
  goingToFutureConstruction.categoryId = category.id;
  goingToFutureConstruction.name = 'going to future';
  goingToFutureConstruction.slug = 'devseed-going-to-future';
  goingToFutureConstruction.cheatSheetContent =
    '## Form\n\n`be` + going to + base verb.';
  goingToFutureConstruction.sortOrder = 2;
  em.persist(goingToFutureConstruction);

  const goingToFutureUp = new GrammarUsagePoint();
  goingToFutureUp.constructionId = goingToFutureConstruction.id;
  goingToFutureUp.egpIndex = 91002;
  goingToFutureUp.cefrLevel = CefrLevel.A2;
  goingToFutureUp.guideword = 'USE: FUTURE PLANS';
  goingToFutureUp.canDoStatement =
    'Can talk about a plan or intention decided before now.';
  goingToFutureUp.exampleText = 'She is going to walk home.';
  goingToFutureUp.learnerExplanation =
    'We use "be going to" for a plan or intention decided before the moment of speaking.';
  goingToFutureUp.learnerExamples = [
    'She is going to walk home.',
    'We are going to visit Berlin next year.',
  ];
  goingToFutureUp.translations = {
    uk: {
      explanation:
        '"be going to" вживається для плану чи наміру, вирішеного до моменту мовлення.',
    },
  };
  em.persist(goingToFutureUp);

  const presentContinuousConstruction = new GrammarConstruction();
  presentContinuousConstruction.categoryId = category.id;
  presentContinuousConstruction.name = 'present continuous';
  presentContinuousConstruction.slug = 'devseed-present-continuous';
  presentContinuousConstruction.cheatSheetContent =
    '## Form\n\n`am/is/are` + verb-ing.';
  presentContinuousConstruction.sortOrder = 3;
  em.persist(presentContinuousConstruction);

  const presentContinuousUp = new GrammarUsagePoint();
  presentContinuousUp.constructionId = presentContinuousConstruction.id;
  presentContinuousUp.egpIndex = 91003;
  presentContinuousUp.cefrLevel = CefrLevel.A1;
  presentContinuousUp.guideword = 'USE: ACTIONS HAPPENING NOW';
  presentContinuousUp.canDoStatement =
    'Can describe an action that is happening right now.';
  presentContinuousUp.exampleText = 'She is walking home now.';
  presentContinuousUp.learnerExplanation =
    'We use the present continuous for an action happening at the moment of speaking.';
  presentContinuousUp.learnerExamples = [
    'She is walking home now.',
    'They are eating dinner.',
  ];
  presentContinuousUp.translations = {
    uk: {
      explanation:
        'Present continuous вживається для дії, яка відбувається саме зараз.',
    },
  };
  em.persist(presentContinuousUp);

  // --- Post 1 (A1): every raw spaCy POS tag, incl. all 8 function-word
  // tags and the highest-frequency lemma-specific role overrides. ---
  const post1 = createPost(
    POST_SHORT_IDS[0],
    'Dev Seed: A1 Word Types',
    'dev-seed-a1-word-types',
    CefrLevel.A1,
    now.minus({ days: 1 }),
  );
  em.persist(post1);

  // "A lopsided gazebo stood near the fence." — DET(a), ADJ+word, NOUN+word,
  // VERB (past simple), ADP.
  const u1 = createSentenceUnit(
    em,
    post1,
    0,
    [
      {
        text: 'A',
        pos: 'DET',
        tag: 'DT',
        lemma: 'a',
        dep: 'det',
        headPosition: 2,
      },
      { text: 'lopsided', pos: 'ADJ', tag: 'JJ', dep: 'amod', headPosition: 2 },
      { text: 'gazebo', pos: 'NOUN', tag: 'NN', dep: 'nsubj', headPosition: 3 },
      {
        text: 'stood',
        pos: 'VERB',
        tag: 'VBD',
        lemma: 'stand',
        morph: { Tense: 'Past', VerbForm: 'Fin' },
        dep: 'ROOT',
      },
      { text: 'near', pos: 'ADP', tag: 'IN', dep: 'prep', headPosition: 3 },
      {
        text: 'the',
        pos: 'DET',
        tag: 'DT',
        lemma: 'the',
        dep: 'det',
        headPosition: 6,
      },
      { text: 'fence', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 4 },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ],
    [
      {
        tokenPositions: [1],
        kind: 'word',
        wordDefinitionId: lopsidedDef.id,
        posLabel: 'ADJ',
      },
      {
        tokenPositions: [2],
        kind: 'word',
        wordDefinitionId: gazeboDef.id,
        posLabel: 'NOUN',
      },
    ],
  );
  sentenceCount += 1;
  tokenCount += u1.tokens.length;

  // "She begrudgingly visits Berlin." — PRON, ADV+word, VERB (present
  // simple), PROPN.
  const u2 = createSentenceUnit(
    em,
    post1,
    1,
    [
      {
        text: 'She',
        pos: 'PRON',
        tag: 'PRP',
        lemma: 'she',
        dep: 'nsubj',
        headPosition: 2,
      },
      {
        text: 'begrudgingly',
        pos: 'ADV',
        tag: 'RB',
        dep: 'advmod',
        headPosition: 2,
      },
      {
        text: 'visits',
        pos: 'VERB',
        tag: 'VBZ',
        lemma: 'visit',
        morph: { Tense: 'Pres', VerbForm: 'Fin' },
        dep: 'ROOT',
      },
      {
        text: 'Berlin',
        pos: 'PROPN',
        tag: 'NNP',
        dep: 'dobj',
        headPosition: 2,
      },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ],
    [
      {
        tokenPositions: [1],
        kind: 'word',
        wordDefinitionId: begrudginglyDef.id,
        posLabel: 'ADV',
      },
    ],
  );
  sentenceCount += 1;
  tokenCount += u2.tokens.length;

  // "Wow, she has three cats and a small dog!" — INTJ, AUX, NUM, CCONJ(and),
  // DET(a).
  const u3 = createSentenceUnit(em, post1, 2, [
    { text: 'Wow', pos: 'INTJ', tag: 'UH' },
    { text: ',', pos: 'PUNCT', tag: ',' },
    { text: 'she', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 3 },
    {
      text: 'has',
      pos: 'AUX',
      tag: 'VBZ',
      lemma: 'have',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'ROOT',
    },
    { text: 'three', pos: 'NUM', tag: 'CD', dep: 'nummod', headPosition: 5 },
    { text: 'cats', pos: 'NOUN', tag: 'NNS', dep: 'dobj', headPosition: 3 },
    {
      text: 'and',
      pos: 'CCONJ',
      tag: 'CC',
      lemma: 'and',
      dep: 'cc',
      headPosition: 5,
    },
    {
      text: 'a',
      pos: 'DET',
      tag: 'DT',
      lemma: 'a',
      dep: 'det',
      headPosition: 9,
    },
    { text: 'small', pos: 'ADJ', tag: 'JJ', dep: 'amod', headPosition: 9 },
    { text: 'dog', pos: 'NOUN', tag: 'NN', dep: 'conj', headPosition: 5 },
    { text: '!', pos: 'PUNCT', tag: '.' },
  ]);
  sentenceCount += 1;
  tokenCount += u3.tokens.length;

  // "She wants to walk because she is happy." — PART(to, infinitive marker),
  // SCONJ(because), bare infinitive carries no tense.
  const u4 = createSentenceUnit(em, post1, 3, [
    { text: 'She', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 1 },
    {
      text: 'wants',
      pos: 'VERB',
      tag: 'VBZ',
      lemma: 'want',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'ROOT',
    },
    {
      text: 'to',
      pos: 'PART',
      tag: 'TO',
      lemma: 'to',
      dep: 'aux',
      headPosition: 3,
    },
    { text: 'walk', pos: 'VERB', tag: 'VB', dep: 'xcomp', headPosition: 1 },
    {
      text: 'because',
      pos: 'SCONJ',
      tag: 'IN',
      lemma: 'because',
      dep: 'mark',
      headPosition: 6,
    },
    { text: 'she', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 6 },
    {
      text: 'is',
      pos: 'AUX',
      tag: 'VBZ',
      lemma: 'be',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'advcl',
      headPosition: 1,
    },
    { text: 'happy', pos: 'ADJ', tag: 'JJ', dep: 'acomp', headPosition: 6 },
    { text: '.', pos: 'PUNCT', tag: '.' },
  ]);
  sentenceCount += 1;
  tokenCount += u4.tokens.length;

  // "She does not like it." — PART(not, negation) + PRON(it) overrides.
  const u5 = createSentenceUnit(em, post1, 4, [
    { text: 'She', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 3 },
    {
      text: 'does',
      pos: 'AUX',
      tag: 'VBZ',
      lemma: 'do',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'aux',
      headPosition: 3,
    },
    {
      text: 'not',
      pos: 'PART',
      tag: 'RB',
      lemma: 'not',
      dep: 'neg',
      headPosition: 3,
    },
    { text: 'like', pos: 'VERB', tag: 'VB', dep: 'ROOT' },
    {
      text: 'it',
      pos: 'PRON',
      tag: 'PRP',
      lemma: 'it',
      dep: 'dobj',
      headPosition: 3,
    },
    { text: '.', pos: 'PUNCT', tag: '.' },
  ]);
  sentenceCount += 1;
  tokenCount += u5.tokens.length;

  // "The book is of great value in the library on the shelf at noon for
  // study with care." — ADP overrides: of, in, on, at, for, with.
  const u6 = createSentenceUnit(em, post1, 5, [
    {
      text: 'The',
      pos: 'DET',
      tag: 'DT',
      lemma: 'the',
      dep: 'det',
      headPosition: 1,
    },
    { text: 'book', pos: 'NOUN', tag: 'NN', dep: 'nsubj', headPosition: 2 },
    {
      text: 'is',
      pos: 'AUX',
      tag: 'VBZ',
      lemma: 'be',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'ROOT',
    },
    {
      text: 'of',
      pos: 'ADP',
      tag: 'IN',
      lemma: 'of',
      dep: 'prep',
      headPosition: 2,
    },
    { text: 'great', pos: 'ADJ', tag: 'JJ', dep: 'amod', headPosition: 5 },
    { text: 'value', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 3 },
    {
      text: 'in',
      pos: 'ADP',
      tag: 'IN',
      lemma: 'in',
      dep: 'prep',
      headPosition: 2,
    },
    {
      text: 'the',
      pos: 'DET',
      tag: 'DT',
      lemma: 'the',
      dep: 'det',
      headPosition: 8,
    },
    { text: 'library', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 6 },
    {
      text: 'on',
      pos: 'ADP',
      tag: 'IN',
      lemma: 'on',
      dep: 'prep',
      headPosition: 2,
    },
    {
      text: 'the',
      pos: 'DET',
      tag: 'DT',
      lemma: 'the',
      dep: 'det',
      headPosition: 11,
    },
    { text: 'shelf', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 9 },
    {
      text: 'at',
      pos: 'ADP',
      tag: 'IN',
      lemma: 'at',
      dep: 'prep',
      headPosition: 2,
    },
    { text: 'noon', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 12 },
    {
      text: 'for',
      pos: 'ADP',
      tag: 'IN',
      lemma: 'for',
      dep: 'prep',
      headPosition: 2,
    },
    { text: 'study', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 14 },
    {
      text: 'with',
      pos: 'ADP',
      tag: 'IN',
      lemma: 'with',
      dep: 'prep',
      headPosition: 2,
    },
    { text: 'care', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 16 },
    { text: '.', pos: 'PUNCT', tag: '.' },
  ]);
  sentenceCount += 1;
  tokenCount += u6.tokens.length;

  // "She thinks that he is tired, but he wants coffee or tea." — SCONJ(that),
  // CCONJ(but/or) overrides.
  const u7 = createSentenceUnit(em, post1, 6, [
    { text: 'She', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 1 },
    {
      text: 'thinks',
      pos: 'VERB',
      tag: 'VBZ',
      lemma: 'think',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'ROOT',
    },
    {
      text: 'that',
      pos: 'SCONJ',
      tag: 'IN',
      lemma: 'that',
      dep: 'mark',
      headPosition: 4,
    },
    { text: 'he', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 4 },
    {
      text: 'is',
      pos: 'AUX',
      tag: 'VBZ',
      lemma: 'be',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'ccomp',
      headPosition: 1,
    },
    { text: 'tired', pos: 'ADJ', tag: 'JJ', dep: 'acomp', headPosition: 4 },
    { text: ',', pos: 'PUNCT', tag: ',' },
    {
      text: 'but',
      pos: 'CCONJ',
      tag: 'CC',
      lemma: 'but',
      dep: 'cc',
      headPosition: 1,
    },
    { text: 'he', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 9 },
    {
      text: 'wants',
      pos: 'VERB',
      tag: 'VBZ',
      lemma: 'want',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'conj',
      headPosition: 1,
    },
    { text: 'coffee', pos: 'NOUN', tag: 'NN', dep: 'dobj', headPosition: 9 },
    {
      text: 'or',
      pos: 'CCONJ',
      tag: 'CC',
      lemma: 'or',
      dep: 'cc',
      headPosition: 10,
    },
    { text: 'tea', pos: 'NOUN', tag: 'NN', dep: 'conj', headPosition: 10 },
    { text: '.', pos: 'PUNCT', tag: '.' },
  ]);
  sentenceCount += 1;
  tokenCount += u7.tokens.length;

  // "He finally broke the ice at the gazebo." — a single-token idiom (the
  // whole inflected surface form is one SentenceToken, same pattern as
  // seed-web-e2e.ts's "at loose ends"), reusing the "gazebo" word above.
  const u8 = createSentenceUnit(
    em,
    post1,
    7,
    [
      { text: 'He', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 2 },
      {
        text: 'finally',
        pos: 'ADV',
        tag: 'RB',
        dep: 'advmod',
        headPosition: 2,
      },
      {
        text: 'broke the ice',
        pos: 'VERB',
        tag: 'VBD',
        lemma: 'break the ice',
        morph: { Tense: 'Past', VerbForm: 'Fin' },
        dep: 'ROOT',
        phraseId: breakTheIcePhrase.id,
        isIdiomPart: true,
      },
      {
        text: 'at',
        pos: 'ADP',
        tag: 'IN',
        lemma: 'at',
        dep: 'prep',
        headPosition: 2,
      },
      {
        text: 'the',
        pos: 'DET',
        tag: 'DT',
        lemma: 'the',
        dep: 'det',
        headPosition: 5,
      },
      { text: 'gazebo', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 3 },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ],
    [
      { tokenPositions: [2], kind: 'phrase', phraseId: breakTheIcePhrase.id },
      {
        tokenPositions: [5],
        kind: 'word',
        wordDefinitionId: gazeboDef.id,
        posLabel: 'NOUN',
      },
    ],
  );
  sentenceCount += 1;
  tokenCount += u8.tokens.length;

  // --- Post 2 (A2): the full tense x aspect grid + going-to-future, one
  // sentence per combination, same subject/verb throughout so the pattern is
  // easy to compare across the reader's Tenses toolbar. ---
  const post2 = createPost(
    POST_SHORT_IDS[1],
    'Dev Seed: A2 Tenses & Aspects',
    'dev-seed-a2-tenses-and-aspects',
    CefrLevel.A2,
    now.minus({ days: 2 }),
  );
  em.persist(post2);

  const adv = (text: string, headPosition: number): TokenSpec => ({
    text,
    pos: 'ADV',
    tag: 'RB',
    dep: 'advmod',
    headPosition,
  });
  const she = (headPosition: number): TokenSpec => ({
    text: 'She',
    pos: 'PRON',
    tag: 'PRP',
    lemma: 'she',
    dep: 'nsubj',
    headPosition,
  });
  const punct: TokenSpec = { text: '.', pos: 'PUNCT', tag: '.' };

  const tenseSentences: {
    label: string;
    specs: TokenSpec[];
    spans?: SpanSpec[];
  }[] = [
    {
      label: 'present simple',
      specs: [
        she(1),
        {
          text: 'meanders',
          pos: 'VERB',
          tag: 'VBZ',
          lemma: 'meander',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          dep: 'ROOT',
        },
        adv('home', 1),
        punct,
      ],
      spans: [
        {
          tokenPositions: [1],
          kind: 'word',
          wordDefinitionId: meanderDef.id,
          posLabel: 'VERB',
        },
      ],
    },
    {
      label: 'past simple',
      specs: [
        she(1),
        {
          text: 'meandered',
          pos: 'VERB',
          tag: 'VBD',
          lemma: 'meander',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          dep: 'ROOT',
        },
        adv('home', 1),
        punct,
      ],
    },
    {
      label: 'future simple',
      specs: [
        she(2),
        {
          text: 'will',
          pos: 'AUX',
          tag: 'MD',
          lemma: 'will',
          morph: { VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 2,
        },
        { text: 'meander', pos: 'VERB', tag: 'VB', dep: 'ROOT' },
        adv('home', 2),
        punct,
      ],
    },
    {
      label: 'present continuous',
      specs: [
        she(2),
        {
          text: 'is',
          pos: 'AUX',
          tag: 'VBZ',
          lemma: 'be',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 2,
        },
        { text: 'meandering', pos: 'VERB', tag: 'VBG', dep: 'ROOT' },
        adv('home', 2),
        punct,
      ],
    },
    {
      label: 'past continuous',
      specs: [
        she(2),
        {
          text: 'was',
          pos: 'AUX',
          tag: 'VBD',
          lemma: 'be',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 2,
        },
        { text: 'meandering', pos: 'VERB', tag: 'VBG', dep: 'ROOT' },
        adv('home', 2),
        punct,
      ],
    },
    {
      label: 'future continuous',
      specs: [
        she(3),
        {
          text: 'will',
          pos: 'AUX',
          tag: 'MD',
          lemma: 'will',
          morph: { VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 3,
        },
        {
          text: 'be',
          pos: 'AUX',
          tag: 'VB',
          lemma: 'be',
          dep: 'aux',
          headPosition: 3,
        },
        { text: 'meandering', pos: 'VERB', tag: 'VBG', dep: 'ROOT' },
        adv('home', 3),
        punct,
      ],
    },
    {
      label: 'present perfect',
      specs: [
        she(2),
        {
          text: 'has',
          pos: 'AUX',
          tag: 'VBZ',
          lemma: 'have',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 2,
        },
        { text: 'meandered', pos: 'VERB', tag: 'VBN', dep: 'ROOT' },
        adv('home', 2),
        punct,
      ],
    },
    {
      label: 'past perfect',
      specs: [
        she(2),
        {
          text: 'had',
          pos: 'AUX',
          tag: 'VBD',
          lemma: 'have',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 2,
        },
        { text: 'meandered', pos: 'VERB', tag: 'VBN', dep: 'ROOT' },
        adv('home', 2),
        punct,
      ],
    },
    {
      label: 'future perfect',
      specs: [
        she(3),
        {
          text: 'will',
          pos: 'AUX',
          tag: 'MD',
          lemma: 'will',
          morph: { VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 3,
        },
        {
          text: 'have',
          pos: 'AUX',
          tag: 'VB',
          lemma: 'have',
          dep: 'aux',
          headPosition: 3,
        },
        { text: 'meandered', pos: 'VERB', tag: 'VBN', dep: 'ROOT' },
        adv('home', 3),
        punct,
      ],
    },
    {
      label: 'present perfect continuous',
      specs: [
        she(3),
        {
          text: 'has',
          pos: 'AUX',
          tag: 'VBZ',
          lemma: 'have',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 3,
        },
        {
          text: 'been',
          pos: 'AUX',
          tag: 'VBN',
          lemma: 'be',
          dep: 'aux',
          headPosition: 3,
        },
        { text: 'meandering', pos: 'VERB', tag: 'VBG', dep: 'ROOT' },
        adv('home', 3),
        punct,
      ],
    },
    {
      label: 'past perfect continuous',
      specs: [
        she(3),
        {
          text: 'had',
          pos: 'AUX',
          tag: 'VBD',
          lemma: 'have',
          morph: { Tense: 'Past', VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 3,
        },
        {
          text: 'been',
          pos: 'AUX',
          tag: 'VBN',
          lemma: 'be',
          dep: 'aux',
          headPosition: 3,
        },
        { text: 'meandering', pos: 'VERB', tag: 'VBG', dep: 'ROOT' },
        adv('home', 3),
        punct,
      ],
    },
    {
      label: 'future perfect continuous',
      specs: [
        she(4),
        {
          text: 'will',
          pos: 'AUX',
          tag: 'MD',
          lemma: 'will',
          morph: { VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 4,
        },
        {
          text: 'have',
          pos: 'AUX',
          tag: 'VB',
          lemma: 'have',
          dep: 'aux',
          headPosition: 4,
        },
        {
          text: 'been',
          pos: 'AUX',
          tag: 'VBN',
          lemma: 'be',
          dep: 'aux',
          headPosition: 4,
        },
        { text: 'meandering', pos: 'VERB', tag: 'VBG', dep: 'ROOT' },
        adv('home', 4),
        punct,
      ],
    },
    {
      label: 'going-to-future',
      specs: [
        she(2),
        {
          text: 'is',
          pos: 'AUX',
          tag: 'VBZ',
          lemma: 'be',
          morph: { Tense: 'Pres', VerbForm: 'Fin' },
          dep: 'aux',
          headPosition: 2,
        },
        { text: 'going', pos: 'VERB', tag: 'VBG', lemma: 'go', dep: 'ROOT' },
        {
          text: 'to',
          pos: 'PART',
          tag: 'TO',
          lemma: 'to',
          dep: 'aux',
          headPosition: 4,
        },
        {
          text: 'meander',
          pos: 'VERB',
          tag: 'VB',
          dep: 'xcomp',
          headPosition: 2,
        },
        adv('home', 4),
        punct,
      ],
    },
  ];

  tenseSentences.forEach((entry, index) => {
    const unit = createSentenceUnit(em, post2, index, entry.specs, entry.spans);
    sentenceCount += 1;
    tokenCount += unit.tokens.length;
  });

  // --- Post 3 (B1): grammar usage points (node-tree spans + GrammarMatch
  // rows) and one exercise of every ExerciseType. ---
  const post3 = createPost(
    POST_SHORT_IDS[2],
    'Dev Seed: B1 Grammar & Exercises',
    'dev-seed-b1-grammar-and-exercises',
    CefrLevel.B1,
    now.minus({ days: 3 }),
  );
  em.persist(post3);

  // "By evening, she had walked ten miles." — past perfect, both as a
  // grammar_only span and a GrammarMatch row.
  const pastPerfectUnit = createSentenceUnit(
    em,
    post3,
    0,
    [
      {
        text: 'By',
        pos: 'ADP',
        tag: 'IN',
        lemma: 'by',
        dep: 'prep',
        headPosition: 5,
      },
      { text: 'evening', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 0 },
      { text: ',', pos: 'PUNCT', tag: ',' },
      { text: 'she', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 5 },
      {
        text: 'had',
        pos: 'AUX',
        tag: 'VBD',
        lemma: 'have',
        morph: { Tense: 'Past', VerbForm: 'Fin' },
        dep: 'aux',
        headPosition: 5,
      },
      { text: 'walked', pos: 'VERB', tag: 'VBN', dep: 'ROOT' },
      { text: 'ten', pos: 'NUM', tag: 'CD', dep: 'nummod', headPosition: 7 },
      {
        text: 'miles',
        pos: 'NOUN',
        tag: 'NNS',
        dep: 'npadvmod',
        headPosition: 5,
      },
      { text: '.', pos: 'PUNCT', tag: '.' },
    ],
    [
      {
        tokenPositions: [4, 5],
        kind: 'grammar_only',
        grammarConstruct: pastPerfectConstruction.slug,
      },
    ],
  );
  sentenceCount += 1;
  tokenCount += pastPerfectUnit.tokens.length;
  addGrammarMatch(em, pastPerfectUnit.sentence.id, pastPerfectUp.id, 4, 6);

  // "Look, she is going to walk home!" — going-to-future, both layers.
  const goingToFutureUnit = createSentenceUnit(
    em,
    post3,
    1,
    [
      { text: 'Look', pos: 'INTJ', tag: 'UH' },
      { text: ',', pos: 'PUNCT', tag: ',' },
      { text: 'she', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 4 },
      {
        text: 'is',
        pos: 'AUX',
        tag: 'VBZ',
        lemma: 'be',
        morph: { Tense: 'Pres', VerbForm: 'Fin' },
        dep: 'aux',
        headPosition: 4,
      },
      { text: 'going', pos: 'VERB', tag: 'VBG', lemma: 'go', dep: 'ROOT' },
      {
        text: 'to',
        pos: 'PART',
        tag: 'TO',
        lemma: 'to',
        dep: 'aux',
        headPosition: 6,
      },
      { text: 'walk', pos: 'VERB', tag: 'VB', dep: 'xcomp', headPosition: 4 },
      { text: 'home', pos: 'ADV', tag: 'RB', dep: 'advmod', headPosition: 6 },
      { text: '!', pos: 'PUNCT', tag: '.' },
    ],
    [
      {
        tokenPositions: [3, 4, 5, 6],
        kind: 'grammar_only',
        grammarConstruct: goingToFutureConstruction.slug,
      },
    ],
  );
  sentenceCount += 1;
  tokenCount += goingToFutureUnit.tokens.length;
  addGrammarMatch(em, goingToFutureUnit.sentence.id, goingToFutureUp.id, 3, 7);

  // "She is walking home now." — present continuous, GrammarMatch only (no
  // node-tree span), mirroring how a guest-visible match can exist without a
  // grammar_only span in the body.
  const presentContinuousUnit = createSentenceUnit(em, post3, 2, [
    { text: 'She', pos: 'PRON', tag: 'PRP', dep: 'nsubj', headPosition: 2 },
    {
      text: 'is',
      pos: 'AUX',
      tag: 'VBZ',
      lemma: 'be',
      morph: { Tense: 'Pres', VerbForm: 'Fin' },
      dep: 'aux',
      headPosition: 2,
    },
    { text: 'walking', pos: 'VERB', tag: 'VBG', dep: 'ROOT' },
    { text: 'home', pos: 'ADV', tag: 'RB', dep: 'advmod', headPosition: 2 },
    { text: 'now', pos: 'ADV', tag: 'RB', dep: 'advmod', headPosition: 2 },
    { text: '.', pos: 'PUNCT', tag: '.' },
  ]);
  sentenceCount += 1;
  tokenCount += presentContinuousUnit.tokens.length;
  addGrammarMatch(
    em,
    presentContinuousUnit.sentence.id,
    presentContinuousUp.id,
    1,
    3,
  );

  addExercise(em, post3.id, ExerciseType.FillBlank, ExerciseSource.Spacy, {
    sentenceId: pastPerfectUnit.sentence.id,
    prompt: 'By evening, she had ____ ten miles.',
    answer: 'walked',
    lemma: 'meander',
    tokenPosition: 5,
    options: ['walked', 'walking', 'walk'],
  });
  exerciseCount += 1;

  addExercise(em, post3.id, ExerciseType.FindError, ExerciseSource.Spacy, {
    sentenceId: pastPerfectUnit.sentence.id,
    prompt: 'By evening, she had walk ten miles.',
    tokenPosition: 5,
    incorrectForm: 'walk',
    correction: 'walked',
  });
  exerciseCount += 1;

  addExercise(em, post3.id, ExerciseType.MultipleChoice, ExerciseSource.Spacy, {
    sentenceId: goingToFutureUnit.sentence.id,
    prompt: 'She is ____ to walk home!',
    options: ['going', 'goes', 'gone', 'go'],
    answerIndex: 0,
    tokenPosition: 4,
  });
  exerciseCount += 1;

  addExercise(
    em,
    post3.id,
    ExerciseType.GrammarContrastive,
    ExerciseSource.Ai,
    {
      grammarUsagePointId: goingToFutureUp.id,
      sentenceId: goingToFutureUnit.sentence.id,
      explanation:
        '"is going to" describes a plan decided before now; "will" would suggest a decision made at the moment of speaking.',
      question: 'She ____ to walk home!',
      options: ['is going', 'will go', 'went'],
      answerIndex: 0,
      optionExplanations: [
        'Plan already decided.',
        'Spontaneous decision, not a plan.',
        'Wrong time frame.',
      ],
    },
  );
  exerciseCount += 1;

  addExercise(em, post3.id, ExerciseType.Reorder, ExerciseSource.Spacy, {
    sentenceId: presentContinuousUnit.sentence.id,
    // original order: she / is / walking / home / now
    scrambled: ['walking', 'now', 'she', 'home', 'is'],
    answer: [2, 4, 0, 3, 1],
  });
  exerciseCount += 1;

  // --- Post 4 (B2): CEFR-level variety, no new POS/tense/grammar coverage
  // needed (already exhaustive above). ---
  const post4 = createPost(
    POST_SHORT_IDS[3],
    'Dev Seed: B2 Reading Practice',
    'dev-seed-b2-reading-practice',
    CefrLevel.B2,
    now.minus({ days: 4 }),
  );
  em.persist(post4);

  const b2Unit = createSentenceUnit(em, post4, 0, [
    {
      text: 'The',
      pos: 'DET',
      tag: 'DT',
      lemma: 'the',
      dep: 'det',
      headPosition: 1,
    },
    {
      text: 'committee',
      pos: 'NOUN',
      tag: 'NN',
      dep: 'nsubj',
      headPosition: 3,
    },
    {
      text: 'carefully',
      pos: 'ADV',
      tag: 'RB',
      dep: 'advmod',
      headPosition: 3,
    },
    {
      text: 'reviewed',
      pos: 'VERB',
      tag: 'VBD',
      lemma: 'review',
      morph: { Tense: 'Past', VerbForm: 'Fin' },
      dep: 'ROOT',
    },
    {
      text: 'the',
      pos: 'DET',
      tag: 'DT',
      lemma: 'the',
      dep: 'det',
      headPosition: 5,
    },
    { text: 'proposal', pos: 'NOUN', tag: 'NN', dep: 'dobj', headPosition: 3 },
    { text: 'before', pos: 'ADP', tag: 'IN', dep: 'prep', headPosition: 3 },
    {
      text: 'the',
      pos: 'DET',
      tag: 'DT',
      lemma: 'the',
      dep: 'det',
      headPosition: 8,
    },
    { text: 'meeting', pos: 'NOUN', tag: 'NN', dep: 'pobj', headPosition: 6 },
    { text: '.', pos: 'PUNCT', tag: '.' },
  ]);
  sentenceCount += 1;
  tokenCount += b2Unit.tokens.length;

  return {
    posts: POST_SHORT_IDS.length,
    sentences: sentenceCount,
    tokens: tokenCount,
    exercises: exerciseCount,
  };
}

@SubCommand({
  name: 'dev-seed',
  description:
    'Seed deterministic reader-page fixtures on the dev DB (word types, tenses+aspect, grammar usage points, every exercise type) for manual QA — idempotent, no spaCy/AI calls',
})
export class PostDevSeedCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    const em = this.orm.em;
    await wipe(em);
    const summary = await seed(em);
    await em.flush();
    this.logger.log(summary, 'dev reader fixtures seeded');
  }
}
