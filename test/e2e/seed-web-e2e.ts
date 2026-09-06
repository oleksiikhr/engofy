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
import { AuthChallenge } from '../../src/modules/auth/entities/auth-challenge.entity.js';
import { AuthSession } from '../../src/modules/auth/entities/auth-session.entity.js';
import { User } from '../../src/modules/auth/entities/user.entity.js';
import { Subscription } from '../../src/modules/billing/entities/subscription.entity.js';
import { LearningCard } from '../../src/modules/learning/entities/learning-card.entity.js';
import { ReviewLog } from '../../src/modules/learning/entities/review-log.entity.js';
import { UserSkillProgress } from '../../src/modules/learning/entities/user-skill-progress.entity.js';
import { LearningCardState } from '../../src/modules/learning/enums/learning-card-state.enum.js';
import { ReviewRating } from '../../src/modules/learning/enums/review-rating.enum.js';
import { PostSource } from '../../src/modules/post/embeddables/post-source.embeddable.js';
import { Exercise } from '../../src/modules/post/entities/exercise.entity.js';
import { GrammarCategory } from '../../src/modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../src/modules/post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../src/modules/post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../src/modules/post/entities/phrase.entity.js';
import { Post } from '../../src/modules/post/entities/post.entity.js';
import { PostPart } from '../../src/modules/post/entities/post-part.entity.js';
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
// Fresh address (no user yet) + a pending OTP challenge, for the /login flow.
export const E2E_LOGIN_EMAIL = 'login-e2e@engofy.test';
export const E2E_LOGIN_OTP = '424242';

const WORD_LEMMA = 'perambulate';
const PHRASE_TEXT = 'at loose ends';
const CATEGORY_NAME = 'E2E: Tenses';

const ENTITIES = [
  User,
  AuthSession,
  AuthChallenge,
  Subscription,
  LearningCard,
  ReviewLog,
  UserSkillProgress,
  Post,
  PostPart,
  Exercise,
  Word,
  WordDefinition,
  Phrase,
  GrammarCategory,
  GrammarConstruction,
  GrammarUsagePoint,
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
    await em.nativeDelete(UserSkillProgress, { userId: user.id });
    await em.nativeDelete(Subscription, { userId: user.id });
    await em.nativeDelete(AuthSession, { userId: user.id });
    await em.nativeDelete(User, { id: user.id });
  }

  const posts = await em.find(Post, {
    shortId: { $in: [E2E_READER_SHORT_ID, ...E2E_FEED_SHORT_IDS] },
  });
  const postIds = posts.map((p) => p.id);
  await em.nativeDelete(Exercise, { postId: { $in: postIds } });
  await em.nativeDelete(PostPart, { postId: { $in: postIds } });
  await em.nativeDelete(Post, { id: { $in: postIds } });

  const constructions = await em.find(GrammarConstruction, {
    slug: { $in: [E2E_GRAMMAR_SLUG, E2E_GRAMMAR_SLUG_2] },
  });
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

  const word = await em.findOne(Word, { lemma: WORD_LEMMA });
  if (word) {
    await em.nativeDelete(WordDefinition, { wordId: word.id });
    await em.nativeDelete(Word, { id: word.id });
  }
  await em.nativeDelete(Phrase, { phraseText: PHRASE_TEXT });
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
  const phrase = em.create(Phrase, {
    phraseText: PHRASE_TEXT,
    type: PhraseType.Idiom,
    definition: 'having nothing particular to do; unoccupied',
    exampleSentence: 'With the shop closed, she was at loose ends all week.',
    cefrLevel: CefrLevel.B2,
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
  em.create(GrammarUsagePoint, {
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

  em.create(PostPart, {
    postId: reader.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'The old cartographer would ' },
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
  em.create(PostPart, {
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
    wordId: word.id,
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
