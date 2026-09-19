/**
 * Deterministic fixtures for the `apps/web` Playwright suite (PLAN.md Slice 8b).
 *
 * Run against the local *dev* database (the one the hand-started Nest web
 * server and `astro dev` talk to) — NOT the test DB, and it never drops the
 * schema. Playwright's global-setup shells out to:
 *
 *   node --import @swc-node/register/esm-register test/e2e/seed-web-e2e.ts
 *
 * It wipes its own previous rows (everything tagged `E2E` / `e2e-` / the
 * fixed e2e user) and re-inserts, so it is safe to run repeatedly.
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { MikroORM } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import ormConfig from '../../src/core/database/mikro-orm.setup.js';
import { AccountDeletionRequest } from '../../src/modules/auth/entities/account-deletion-request.entity.js';
import { AuthChallenge } from '../../src/modules/auth/entities/auth-challenge.entity.js';
import { AuthSession } from '../../src/modules/auth/entities/auth-session.entity.js';
import { User } from '../../src/modules/auth/entities/user.entity.js';
import { Subscription } from '../../src/modules/billing/entities/subscription.entity.js';
import { LearningCard } from '../../src/modules/learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../src/modules/learning/entities/learning-disposition.entity.js';
import { ReviewLog } from '../../src/modules/learning/entities/review-log.entity.js';
import { UserSkillProgress } from '../../src/modules/learning/entities/user-skill-progress.entity.js';
import { Disposition } from '../../src/modules/learning/enums/disposition.enum.js';
import { LearningCardState } from '../../src/modules/learning/enums/learning-card-state.enum.js';
import { ReviewRating } from '../../src/modules/learning/enums/review-rating.enum.js';
import { PostSource } from '../../src/modules/post/embeddables/post-source.embeddable.js';
import { Exercise } from '../../src/modules/post/entities/exercise.entity.js';
import { GrammarCategory } from '../../src/modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../src/modules/post/entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../src/modules/post/entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../src/modules/post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../src/modules/post/entities/phrase.entity.js';
import { Post } from '../../src/modules/post/entities/post.entity.js';
import { PostPart } from '../../src/modules/post/entities/post-part.entity.js';
import { Sentence } from '../../src/modules/post/entities/sentence.entity.js';
import { SentenceToken } from '../../src/modules/post/entities/sentence-token.entity.js';
import { Word } from '../../src/modules/post/entities/word.entity.js';
import { WordDefinition } from '../../src/modules/post/entities/word-definition.entity.js';
import { CefrLevel } from '../../src/modules/post/enums/cefr-level.enum.js';
import { ExerciseSource } from '../../src/modules/post/enums/exercise-source.enum.js';
import { ExerciseType } from '../../src/modules/post/enums/exercise-type.enum.js';
import { PartOfSpeech } from '../../src/modules/post/enums/part-of-speech.enum.js';
import { PhraseType } from '../../src/modules/post/enums/phrase-type.enum.js';
import { PostPartKind } from '../../src/modules/post/enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../src/modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../src/modules/post/enums/post-status.enum.js';

// --- fixed identifiers the specs rely on ---
export const E2E_USER_EMAIL = 'e2e@engofy.test';
export const E2E_SESSION_TOKEN = 'e2e-fixed-session-token-000000000000';
export const E2E_READER_SHORT_ID = 'E2Eread1';
export const E2E_FEED_SHORT_IDS = ['E2Efeed2', 'E2Efeed3', 'E2Efeed4'];
export const E2E_GRAMMAR_SLUG = 'e2e-past-perfect';
export const E2E_GRAMMAR_SLUG_2 = 'e2e-present-simple';
// Both usage points sit above the seeded user's B1 level, so they stay New and
// the detail-page specs can mutate them without shifting any other page's state.
export const E2E_GRAMMAR_SLUG_MUTABLE = 'e2e-conditionals';
// A real EGP slug with a handcrafted page in apps/web/src/grammar-pages.
export const E2E_GRAMMAR_HANDCRAFTED_SLUG = 'past-present-perfect-simple';
// Fresh address (no user yet) + a pending OTP challenge, for the /login flow.
export const E2E_LOGIN_EMAIL = 'login-e2e@engofy.test';
export const E2E_LOGIN_OTP = '424242';
// Own user + session so the /profile deletion specs can't disturb the shared
// e2e user (deletion ends premium). Seeded with a pending deletion request
// whose cancel token the spec uses for the e-mailed-link flow.
export const E2E_DELETION_USER_EMAIL = 'deletion-e2e@engofy.test';
export const E2E_DELETION_SESSION_TOKEN = 'e2e-deletion-session-token-0000000';
export const E2E_DELETION_CANCEL_TOKEN = 'e2e-deletion-cancel-token-000000';

const WORD_LEMMA = 'perambulate';
// A second word in the reader post that no e2e user has saved — what study
// mode offers to add.
const STUDY_WORD_LEMMA = 'cartographer';
const PHRASE_TEXT = 'at loose ends';
// Disposition-only dictionary entries (dictionary-redesign слайд 1) — no
// active card, so /dictionary must resolve their state from
// `learning_dispositions` alone.
const KNOWN_PHRASE_TEXT = 'a piece of cake';
const SKIPPED_PHRASE_TEXT = 'break a leg';
// Never saved (no card/disposition) — dictionary-redesign слайд 3's
// /dictionary/phrases/[phrase] known/skip toggle target; safe to mutate
// without disturbing the other phrases' asserted states.
const UNSAVED_PHRASE_TEXT = 'under the weather';
const CATEGORY_NAME = 'E2E: Tenses';

const ENTITIES = [
  User,
  AccountDeletionRequest,
  AuthSession,
  AuthChallenge,
  Subscription,
  LearningCard,
  LearningDisposition,
  ReviewLog,
  UserSkillProgress,
  Post,
  PostPart,
  Sentence,
  SentenceToken,
  Exercise,
  Word,
  WordDefinition,
  Phrase,
  GrammarCategory,
  GrammarConstruction,
  GrammarUsagePoint,
  GrammarMatch,
];

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function wipe(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();
  const user = await em.findOne(User, { email: E2E_USER_EMAIL });
  if (user) {
    const cards = await em.find(LearningCard, { userId: user.id });
    await em.nativeDelete(ReviewLog, {
      cardId: { $in: cards.map((c) => c.id) },
    });
    await em.nativeDelete(LearningCard, { userId: user.id });
    await em.nativeDelete(LearningDisposition, { userId: user.id });
    await em.nativeDelete(UserSkillProgress, { userId: user.id });
    await em.nativeDelete(Subscription, { userId: user.id });
    await em.nativeDelete(AuthSession, { userId: user.id });
    await em.nativeDelete(User, { id: user.id });
  }

  const deletionUser = await em.findOne(User, {
    email: E2E_DELETION_USER_EMAIL,
  });
  if (deletionUser) {
    await em.nativeDelete(AccountDeletionRequest, { userId: deletionUser.id });
    await em.nativeDelete(AuthSession, { userId: deletionUser.id });
    await em.nativeDelete(User, { id: deletionUser.id });
  }

  const posts = await em.find(Post, {
    shortId: { $in: [E2E_READER_SHORT_ID, ...E2E_FEED_SHORT_IDS] },
  });
  const postIds = posts.map((p) => p.id);
  const sentences = await em.find(Sentence, { postId: { $in: postIds } });
  await em.nativeDelete(GrammarMatch, {
    sentenceId: { $in: sentences.map((s) => s.id) },
  });
  await em.nativeDelete(SentenceToken, {
    sentenceId: { $in: sentences.map((s) => s.id) },
  });
  await em.nativeDelete(Sentence, { postId: { $in: postIds } });
  await em.nativeDelete(Exercise, { postId: { $in: postIds } });
  await em.nativeDelete(PostPart, { postId: { $in: postIds } });
  await em.nativeDelete(Post, { id: { $in: postIds } });

  // By category, not slug: the handcrafted slug is a real EGP one that a dev
  // database may already hold — only the copy this seed created is removed.
  const e2eCategory = await em.findOne(GrammarCategory, {
    name: CATEGORY_NAME,
  });
  const constructions = e2eCategory
    ? await em.find(GrammarConstruction, { categoryId: e2eCategory.id })
    : [];
  await em.nativeDelete(GrammarUsagePoint, {
    constructionId: { $in: constructions.map((c) => c.id) },
  });
  await em.nativeDelete(GrammarConstruction, {
    id: { $in: constructions.map((c) => c.id) },
  });
  await em.nativeDelete(GrammarCategory, { name: CATEGORY_NAME });

  await em.nativeDelete(AuthChallenge, { email: E2E_LOGIN_EMAIL });
  const loginUser = await em.findOne(User, { email: E2E_LOGIN_EMAIL });
  if (loginUser) {
    const loginCards = await em.find(LearningCard, { userId: loginUser.id });
    await em.nativeDelete(ReviewLog, {
      cardId: { $in: loginCards.map((c) => c.id) },
    });
    await em.nativeDelete(LearningCard, { userId: loginUser.id });
    await em.nativeDelete(AuthSession, { userId: loginUser.id });
    await em.nativeDelete(User, { id: loginUser.id });
  }

  const words = await em.find(Word, {
    lemma: { $in: [WORD_LEMMA, STUDY_WORD_LEMMA] },
  });
  if (words.length > 0) {
    const wordIds = words.map((w) => w.id);
    await em.nativeDelete(WordDefinition, { wordId: { $in: wordIds } });
    await em.nativeDelete(Word, { id: { $in: wordIds } });
  }
  await em.nativeDelete(Phrase, { phraseText: PHRASE_TEXT });
  await em.nativeDelete(Phrase, {
    phraseText: {
      $in: [KNOWN_PHRASE_TEXT, SKIPPED_PHRASE_TEXT, UNSAVED_PHRASE_TEXT],
    },
  });
}

async function seed(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();
  const now = DateTime.now();

  // --- lexicon ---
  const word = em.create(Word, { lemma: WORD_LEMMA, frequencyRank: 48210 });
  const wordDef = em.create(WordDefinition, {
    wordId: word.id,
    pos: PartOfSpeech.Verb,
    definition: 'to walk through or around a place, especially for pleasure',
    phonetic: '/pəˈrambjʊleɪt/',
    cefrLevel: CefrLevel.B1,
    exampleSentence: 'They perambulated the gardens after lunch.',
  });
  const studyWord = em.create(Word, {
    lemma: STUDY_WORD_LEMMA,
    frequencyRank: 9000,
  });
  const studyWordDef = em.create(WordDefinition, {
    wordId: studyWord.id,
    pos: PartOfSpeech.Noun,
    definition: 'a person who draws or makes maps',
    phonetic: '/kɑːˈtɒɡrəfə/',
    cefrLevel: CefrLevel.B2,
    exampleSentence: 'The cartographer inked the coastline.',
  });
  // A second, unsaved sense of the same lemma (dictionary-redesign слайд 2) —
  // no card or disposition, so /dictionary/words/perambulate has a target for
  // the "Позначити вивченим"/"Пропустити" toggle that's safe to click without
  // disturbing `wordDef`'s card, which other specs assert stays "learning".
  em.create(WordDefinition, {
    wordId: word.id,
    pos: PartOfSpeech.Noun,
    definition: 'a leisurely walk',
    cefrLevel: CefrLevel.C1,
  });
  const phrase = em.create(Phrase, {
    phraseText: PHRASE_TEXT,
    type: PhraseType.Idiom,
    definition: 'having nothing particular to do; unoccupied',
    exampleSentence: 'With the shop closed, she was at loose ends all week.',
    cefrLevel: CefrLevel.B2,
  });
  const knownPhrase = em.create(Phrase, {
    phraseText: KNOWN_PHRASE_TEXT,
    type: PhraseType.Idiom,
    definition: 'something very easy to do',
    cefrLevel: CefrLevel.A2,
  });
  const skippedPhrase = em.create(Phrase, {
    phraseText: SKIPPED_PHRASE_TEXT,
    type: PhraseType.Idiom,
    definition: 'a way of wishing someone good luck',
    cefrLevel: CefrLevel.A2,
  });

  em.create(Phrase, {
    phraseText: UNSAVED_PHRASE_TEXT,
    type: PhraseType.Idiom,
    definition: 'feeling slightly ill',
    exampleSentence: 'I am a bit under the weather today.',
    cefrLevel: CefrLevel.C1,
  });

  // --- grammar reference ---
  const category = em.create(GrammarCategory, {
    name: CATEGORY_NAME,
    sortOrder: 900,
  });
  const pastPerfect = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'past perfect',
    slug: E2E_GRAMMAR_SLUG,
    cheatSheetContent:
      '## Form\n\n`had` + past participle.\n\n- Affirmative: She **had drawn** the map.\n- Negative: She **had not drawn** the map.',
    sortOrder: 1,
  });
  const pastPerfectUp = em.create(GrammarUsagePoint, {
    constructionId: pastPerfect.id,
    cefrLevel: CefrLevel.A2,
    guideword: 'USE: EARLIER PAST',
    canDoStatement:
      'Can show that one past action happened before another past action.',
    exampleText: 'By the time the war ended, she had drawn every coastline.',
  });
  const pastPerfectReported = em.create(GrammarUsagePoint, {
    constructionId: pastPerfect.id,
    cefrLevel: CefrLevel.B1,
    guideword: 'USE: REPORTED',
    canDoStatement: 'Can use the past perfect in reported speech.',
    exampleText: 'He said he had finished the chart.',
  });
  const presentSimple = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'present simple',
    slug: E2E_GRAMMAR_SLUG_2,
    cheatSheetContent: '## Form\n\nSubject + base verb (+ *-s* for he/she/it).',
    sortOrder: 2,
  });
  em.create(GrammarUsagePoint, {
    constructionId: presentSimple.id,
    cefrLevel: CefrLevel.A1,
    guideword: 'USE: HABITS AND GENERAL FACTS',
    canDoStatement: 'Can describe routines and general facts.',
    exampleText: 'The tide comes in twice a day.',
  });

  const conditionals = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'conditionals',
    slug: E2E_GRAMMAR_SLUG_MUTABLE,
    cheatSheetContent: '## Form\n\nIf + past simple, would + base verb.',
    sortOrder: 4,
  });
  em.create(GrammarUsagePoint, {
    constructionId: conditionals.id,
    cefrLevel: CefrLevel.B2,
    guideword: 'USE: UNREAL PRESENT',
    canDoStatement: 'Can talk about imagined situations in the present.',
    exampleText: 'If I had more time, I would learn the piano.',
  });
  em.create(GrammarUsagePoint, {
    constructionId: conditionals.id,
    cefrLevel: CefrLevel.C1,
    guideword: 'USE: UNREAL PAST',
    canDoStatement: 'Can talk about imagined situations in the past.',
    exampleText: 'If she had known, she would have called.',
  });

  // The handcrafted page's construction: a dev DB that already imported the
  // EGP has the real one, so it is only created when missing.
  const handcrafted = await em.findOne(GrammarConstruction, {
    slug: E2E_GRAMMAR_HANDCRAFTED_SLUG,
  });
  if (!handcrafted) {
    const seeded = em.create(GrammarConstruction, {
      categoryId: category.id,
      name: 'present perfect simple',
      slug: E2E_GRAMMAR_HANDCRAFTED_SLUG,
      cheatSheetContent: null,
      sortOrder: 3,
    });
    em.create(GrammarUsagePoint, {
      constructionId: seeded.id,
      cefrLevel: CefrLevel.A2,
      guideword: 'USE: EXPERIENCES',
      canDoStatement:
        'Can use the present perfect simple to talk about experiences up to now.',
      exampleText: 'I have never been to Lisbon.',
    });
  }

  // --- reader post: node tree with word / phrase / grammar spans ---
  const readerSource = new PostSource();
  readerSource.format = PostSourceFormat.Text;
  readerSource.rawText =
    'The old cartographer would perambulate the harbour at dawn, at loose ends until the boats returned. By the time the war ended, she had drawn every coastline twice.';
  readerSource.link = 'https://example.com/the-cartographer';

  const reader = new Post();
  reader.source = readerSource;
  reader.title = 'The Cartographer at Dawn';
  reader.slug = 'the-cartographer-at-dawn';
  reader.shortId = E2E_READER_SHORT_ID;
  reader.status = PostStatus.Published;
  reader.cefrLevel = CefrLevel.B1;
  reader.publishedAt = now.minus({ days: 1 });
  em.persist(reader);

  const readerPart1 = em.create(PostPart, {
    postId: reader.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'The old ' },
        {
          type: 'span',
          kind: 'word',
          text: 'cartographer',
          wordDefinitionId: studyWordDef.id,
          pos: 'NOUN',
        },
        { type: 'text', text: ' would ' },
        {
          type: 'span',
          kind: 'word',
          text: 'perambulate',
          wordDefinitionId: wordDef.id,
          pos: 'VERB',
        },
        { type: 'text', text: ' the harbour at dawn, ' },
        {
          type: 'span',
          kind: 'phrase',
          text: 'at loose ends',
          phraseId: phrase.id,
        },
        { type: 'text', text: ' until the boats returned.' },
      ],
    },
    annotatedAt: now,
  });

  // Deterministic spaCy layer for the same paragraph (dictionary-redesign
  // слайд 1 — the "Appears in" join on /dictionary reads `sentence_tokens`,
  // not the `PostPart` span annotations above; without this, perambulate /
  // at loose ends would never show a post reference).
  const readerSentence = em.create(Sentence, {
    postId: reader.id,
    postPartId: readerPart1.id,
    unitIndex: 0,
    position: 0,
    rawText: readerSource.rawText,
    charStart: 0,
    charEnd: readerSource.rawText.length,
  });
  em.create(SentenceToken, {
    sentenceId: readerSentence.id,
    position: 0,
    text: 'perambulate',
    charStart: 28,
    charEnd: 39,
    lemma: WORD_LEMMA,
    pos: 'VERB',
    tag: 'VB',
    dep: 'ROOT',
    morph: {},
    wordId: word.id,
  });
  em.create(SentenceToken, {
    sentenceId: readerSentence.id,
    position: 1,
    text: 'at loose ends',
    charStart: 62,
    charEnd: 75,
    lemma: PHRASE_TEXT,
    pos: 'ADV',
    tag: 'RB',
    dep: 'advmod',
    morph: {},
    phraseId: phrase.id,
  });

  const readerPart2 = em.create(PostPart, {
    postId: reader.id,
    blockIndex: 1,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'By the time the war ended, she ' },
        {
          type: 'span',
          kind: 'grammar_only',
          text: 'had drawn',
          grammarConstruct: E2E_GRAMMAR_SLUG,
        },
        { type: 'text', text: ' every coastline twice.' },
      ],
    },
    annotatedAt: now,
  });

  // spaCy layer for block 1 with two grammar matches: "had drawn" (A2 point,
  // New for the A1 e2e user -> labelled) and "war ended" (B1 point the e2e
  // user marks Known below -> labelled for a guest only).
  const grammarSentenceText =
    'By the time the war ended, she had drawn every coastline twice.';
  const grammarSentence = em.create(Sentence, {
    postId: reader.id,
    postPartId: readerPart2.id,
    unitIndex: 0,
    position: 0,
    rawText: grammarSentenceText,
    charStart: 0,
    charEnd: grammarSentenceText.length,
  });
  // [text, charStart, charEnd, lemma, pos, tag, morph]
  const grammarTokens: [
    string,
    number,
    number,
    string,
    string,
    string,
    object,
  ][] = [
    ['By', 0, 2, 'by', 'ADP', 'IN', {}],
    ['the', 3, 6, 'the', 'DET', 'DT', {}],
    ['time', 7, 11, 'time', 'NOUN', 'NN', {}],
    ['the', 12, 15, 'the', 'DET', 'DT', {}],
    ['war', 16, 19, 'war', 'NOUN', 'NN', {}],
    ['ended', 20, 25, 'end', 'VERB', 'VBD', { Tense: 'Past', VerbForm: 'Fin' }],
    [',', 25, 26, ',', 'PUNCT', ',', {}],
    ['she', 27, 30, 'she', 'PRON', 'PRP', {}],
    ['had', 31, 34, 'have', 'AUX', 'VBD', { Tense: 'Past', VerbForm: 'Fin' }],
    [
      'drawn',
      35,
      40,
      'draw',
      'VERB',
      'VBN',
      { Tense: 'Past', VerbForm: 'Part' },
    ],
    ['every', 41, 46, 'every', 'DET', 'DT', {}],
    ['coastline', 47, 56, 'coastline', 'NOUN', 'NN', {}],
    ['twice', 57, 62, 'twice', 'ADV', 'RB', {}],
    ['.', 62, 63, '.', 'PUNCT', '.', {}],
  ];
  grammarTokens.forEach(
    ([text, charStart, charEnd, lemma, pos, tag, morph], position) => {
      em.create(SentenceToken, {
        sentenceId: grammarSentence.id,
        position,
        text,
        charStart,
        charEnd,
        lemma,
        pos,
        tag,
        dep: 'dep',
        morph: morph as Record<string, string>,
      });
    },
  );
  em.create(GrammarMatch, {
    sentenceId: grammarSentence.id,
    grammarUsagePointId: pastPerfectUp.id,
    tokenStart: 8,
    tokenEnd: 10,
  });
  em.create(GrammarMatch, {
    sentenceId: grammarSentence.id,
    grammarUsagePointId: pastPerfectReported.id,
    tokenStart: 4,
    tokenEnd: 6,
  });

  // A phrase the seeded user already marked Known — the reader must mark it
  // for a guest (New) but leave it plain for that user.
  const readerPart3 = em.create(PostPart, {
    postId: reader.id,
    blockIndex: 2,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'Charting the last bay was ' },
        {
          type: 'span',
          kind: 'phrase',
          text: KNOWN_PHRASE_TEXT,
          phraseId: knownPhrase.id,
        },
        { type: 'text', text: ' by then.' },
      ],
    },
    annotatedAt: now,
  });

  // A grammar match over that same phrase, so a guest sees a word/phrase
  // label and a grammar label on one range (the reader's two-section popup).
  // It reuses the "reported" usage point the e2e user marks Known, so it
  // paints nothing for them.
  const overlapText = 'Charting the last bay was a piece of cake by then.';
  const overlapSentence = em.create(Sentence, {
    postId: reader.id,
    postPartId: readerPart3.id,
    unitIndex: 0,
    position: 0,
    rawText: overlapText,
    charStart: 0,
    charEnd: overlapText.length,
  });
  const overlapTokens: [string, number, number][] = [
    ['Charting', 0, 8],
    ['the', 9, 12],
    ['last', 13, 17],
    ['bay', 18, 21],
    ['was', 22, 25],
    ['a', 26, 27],
    ['piece', 28, 33],
    ['of', 34, 36],
    ['cake', 37, 41],
    ['by', 42, 44],
    ['then', 45, 49],
    ['.', 49, 50],
  ];
  overlapTokens.forEach(([text, charStart, charEnd], position) => {
    em.create(SentenceToken, {
      sentenceId: overlapSentence.id,
      position,
      text,
      charStart,
      charEnd,
      lemma: text.toLowerCase(),
      pos: 'X',
      tag: 'X',
      dep: 'dep',
      morph: {},
    });
  });
  em.create(GrammarMatch, {
    sentenceId: overlapSentence.id,
    grammarUsagePointId: pastPerfectReported.id,
    tokenStart: 5,
    tokenEnd: 9,
  });

  const sid = '00000000-0000-4000-8000-00000000e2e0';
  em.create(Exercise, {
    postId: reader.id,
    type: ExerciseType.FillBlank,
    source: ExerciseSource.Spacy,
    payload: {
      sentenceId: sid,
      prompt: 'The old cartographer would ____ the harbour at dawn.',
      answer: 'perambulate',
      lemma: 'perambulate',
      tokenPosition: 4,
      options: ['perambulate', 'wander', 'linger'],
    },
  });
  em.create(Exercise, {
    postId: reader.id,
    type: ExerciseType.MultipleChoice,
    source: ExerciseSource.Spacy,
    payload: {
      sentenceId: sid,
      prompt: 'By the time the war ended, she had ____ every coastline twice.',
      options: ['drawn', 'draw', 'drew', 'drawing'],
      answerIndex: 0,
      tokenPosition: 8,
    },
  });
  em.create(Exercise, {
    postId: reader.id,
    type: ExerciseType.FindError,
    source: ExerciseSource.Spacy,
    payload: {
      sentenceId: sid,
      prompt: 'By the time the war ended, she had draw every coastline twice.',
      tokenPosition: 8,
      incorrectForm: 'draw',
      correction: 'drawn',
    },
  });
  em.create(Exercise, {
    postId: reader.id,
    type: ExerciseType.Reorder,
    source: ExerciseSource.Spacy,
    // original order: the / boats / had / not / returned
    payload: {
      sentenceId: sid,
      scrambled: ['had', 'the', 'returned', 'boats', 'not'],
      answer: [2, 0, 4, 1, 3],
    },
  });
  em.create(Exercise, {
    postId: reader.id,
    type: ExerciseType.GrammarContrastive,
    source: ExerciseSource.Ai,
    payload: {
      grammarUsagePointId: pastPerfectUp.id,
      sentenceId: grammarSentence.id,
      explanation:
        'Past perfect fits because drawing the coastlines finished before the war ended; past simple would not show which came first.',
      question: 'By the time the war ended, she ____ every coastline twice.',
      options: ['had drawn', 'drew', 'has drawn'],
      answerIndex: 0,
      optionExplanations: [
        'Earlier past action.',
        'Does not show the order.',
        'Wrong time frame.',
      ],
    },
  });
  em.create(Exercise, {
    postId: reader.id,
    type: ExerciseType.Comprehension,
    source: ExerciseSource.Ai,
    payload: {
      questions: [
        {
          question: 'What did the cartographer do at dawn?',
          options: [
            'Walked around the harbour',
            'Sailed one of the boats',
            'Drew maps indoors',
            'Slept until midday',
          ],
          answerIndex: 0,
        },
        {
          question: 'How many times had she drawn every coastline?',
          options: ['Once', 'Twice', 'Three times', 'Never'],
          answerIndex: 1,
        },
      ],
    },
  });

  // --- extra published posts for the feed / alternation ---
  E2E_FEED_SHORT_IDS.forEach((shortId, i) => {
    const src = new PostSource();
    src.format = PostSourceFormat.Text;
    src.rawText = `Filler reading number ${i + 2} for the feed. It has a couple of sentences so the excerpt is not empty.`;
    src.link = `https://example.com/feed-${i + 2}`;
    const p = new Post();
    p.source = src;
    p.title = `Feed Story ${i + 2}`;
    p.slug = `feed-story-${i + 2}`;
    p.shortId = shortId;
    p.status = PostStatus.Published;
    p.cefrLevel = [CefrLevel.A2, CefrLevel.B1, CefrLevel.B2][i] ?? CefrLevel.B1;
    p.publishedAt = now.minus({ days: i + 2 });
    em.persist(p);
    em.create(PostPart, {
      postId: p.id,
      blockIndex: 0,
      kind: PostPartKind.Paragraph,
      body: {
        type: 'paragraph',
        children: [{ type: 'text', text: src.rawText }],
      },
      annotatedAt: now,
    });
  });

  // --- e2e user + session ---
  const user = em.create(User, { email: E2E_USER_EMAIL });
  em.create(AuthSession, {
    tokenHash: sha256(E2E_SESSION_TOKEN),
    userId: user.id,
    expiresAt: now.plus({ days: 30 }),
  });

  const deletionUser = em.create(User, { email: E2E_DELETION_USER_EMAIL });
  em.create(AuthSession, {
    tokenHash: sha256(E2E_DELETION_SESSION_TOKEN),
    userId: deletionUser.id,
    expiresAt: now.plus({ days: 30 }),
  });
  em.create(AccountDeletionRequest, {
    userId: deletionUser.id,
    cancelTokenHash: sha256(E2E_DELETION_CANCEL_TOKEN),
  });

  // Pending OTP challenge for the /login flow (no user for this address yet —
  // verify-code creates one).
  em.create(AuthChallenge, {
    email: E2E_LOGIN_EMAIL,
    otpHash: sha256(E2E_LOGIN_OTP),
    attempts: 0,
    expiresAt: now.plus({ minutes: 15 }),
  });

  // --- SRS cards (dictionary + practice) ---
  const wordCard = em.create(LearningCard, {
    userId: user.id,
    wordDefinitionId: wordDef.id,
    due: now.minus({ days: 1 }),
    stability: 3.2,
    difficulty: 5.4,
    elapsedDays: 2,
    scheduledDays: 3,
    reps: 2,
    lapses: 0,
    state: LearningCardState.Review,
    lastReview: now.minus({ days: 3 }),
  });
  em.create(LearningCard, {
    userId: user.id,
    phraseId: phrase.id,
    due: now.minus({ hours: 2 }),
    stability: 1.1,
    difficulty: 6.0,
    elapsedDays: 1,
    scheduledDays: 1,
    reps: 1,
    lapses: 0,
    state: LearningCardState.Learning,
    lastReview: now.minus({ days: 1 }),
  });
  const grammarCard = em.create(LearningCard, {
    userId: user.id,
    grammarUsagePointId: pastPerfectUp.id,
    due: now.minus({ hours: 1 }),
    stability: 12.5,
    difficulty: 4.8,
    elapsedDays: 5,
    scheduledDays: 8,
    reps: 4,
    lapses: 1,
    state: LearningCardState.Review,
    lastReview: now.minus({ days: 1 }),
  });
  em.create(LearningDisposition, {
    userId: user.id,
    phraseId: knownPhrase.id,
    disposition: Disposition.Known,
  });
  em.create(LearningDisposition, {
    userId: user.id,
    phraseId: skippedPhrase.id,
    disposition: Disposition.Skipped,
  });
  em.create(LearningDisposition, {
    userId: user.id,
    grammarUsagePointId: pastPerfectReported.id,
    disposition: Disposition.Known,
  });

  // --- grammar skill progress + review streak (profile) ---
  em.create(UserSkillProgress, {
    userId: user.id,
    constructionId: pastPerfect.id,
    masteryScore: 41,
    correctStreak: 2,
    totalAttempts: 4,
    correctAttempts: 3,
    unlockedAt: now.minus({ days: 3 }),
  });
  for (let d = 0; d < 3; d += 1) {
    em.create(ReviewLog, {
      cardId: grammarCard.id,
      rating: ReviewRating.Good,
      reviewedAt: now.minus({ days: d }),
      elapsedDays: d === 0 ? 1 : 1,
      scheduledDays: 8,
    });
  }
  em.create(ReviewLog, {
    cardId: wordCard.id,
    rating: ReviewRating.Good,
    reviewedAt: now.minus({ days: 1 }),
    elapsedDays: 2,
    scheduledDays: 3,
  });

  await em.flush();
}

async function main(): Promise<void> {
  const orm = await MikroORM.init({
    ...ormConfig,
    entities: ENTITIES,
    entitiesTs: ENTITIES,
    allowGlobalContext: true,
    debug: false,
  });
  try {
    await wipe(orm);
    await seed(orm);
    // eslint-disable-next-line no-console
    console.log('[seed-web-e2e] done');
  } finally {
    await orm.close(true);
  }
}

main().catch((error) => {
  console.error('[seed-web-e2e] failed', error);
  process.exit(1);
});
