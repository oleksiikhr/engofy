import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { GrammarCategory } from '../../../post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../post/entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../../post/entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostPart } from '../../../post/entities/post-part.entity.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
import { Sentence } from '../../../post/entities/sentence.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { PostPartKind } from '../../../post/enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { DAILY_NEW_CARD_LIMIT } from '../../domain/daily-new-card-limit.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { ReviewLog } from '../../entities/review-log.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { ReviewRating } from '../../enums/review-rating.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetPracticeQueueQuery } from './get-practice-queue.query.js';

function card(
  em: EntityManager,
  userId: string,
  due: DateTime,
  target: Partial<
    Pick<LearningCard, 'wordDefinitionId' | 'phraseId' | 'grammarUsagePointId'>
  >,
  state: LearningCardState = LearningCardState.New,
): void {
  em.create(LearningCard, {
    userId,
    wordDefinitionId: target.wordDefinitionId ?? null,
    phraseId: target.phraseId ?? null,
    grammarUsagePointId: target.grammarUsagePointId ?? null,
    due,
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: state === LearningCardState.New ? 0 : 1,
    lapses: 0,
    state,
  });
}

// One post with a single-paragraph PostPart containing the given word span,
// plus a Sentence covering the whole paragraph (wide charStart/charEnd, so
// the exact span offset within it doesn't matter for these tests — the
// offset-precision itself is covered by context-sentence.spec.ts). Enough to
// drive the зріз 1 context-sentence bridge end to end.
async function seedPostWithWordSpan(
  em: EntityManager,
  wordDefinitionId: string,
  rawText: string,
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = rawText;
  const post = new Post();
  post.source = source;
  em.persist(post);

  const part = em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        {
          type: 'span',
          kind: 'word',
          text: rawText,
          wordDefinitionId,
          pos: 'NOUN',
        },
      ],
    },
  });
  em.create(Sentence, {
    postId: post.id,
    postPartId: part.id,
    unitIndex: 0,
    position: 0,
    rawText,
    charStart: 0,
    charEnd: 9999,
  });
  await em.flush();
  return post.id;
}

async function seedPostWithPhraseSpan(
  em: EntityManager,
  phraseId: string,
  rawText: string,
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = rawText;
  const post = new Post();
  post.source = source;
  em.persist(post);

  const part = em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [{ type: 'span', kind: 'phrase', text: rawText, phraseId }],
    },
  });
  em.create(Sentence, {
    postId: post.id,
    postPartId: part.id,
    unitIndex: 0,
    position: 0,
    rawText,
    charStart: 0,
    charEnd: 9999,
  });
  await em.flush();
  return post.id;
}

// A read-able post with one paragraph part and one Sentence, plus a
// `grammar_matches` row tying the sentence to `usagePointId`.
async function seedPostWithGrammarMatch(
  em: EntityManager,
  usagePointId: string,
  rawText: string,
  confidence: number | null = 0.9,
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = rawText;
  const post = new Post();
  post.source = source;
  em.persist(post);

  const part = em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: { type: 'paragraph', children: [{ type: 'text', text: rawText }] },
  });
  const sentence = em.create(Sentence, {
    postId: post.id,
    postPartId: part.id,
    unitIndex: 0,
    position: 0,
    rawText,
    charStart: 0,
    charEnd: rawText.length,
  });
  em.create(GrammarMatch, {
    sentenceId: sentence.id,
    grammarUsagePointId: usagePointId,
    confidence,
    tokenStart: 0,
    tokenEnd: 1,
  });
  await em.flush();
  return post.id;
}

async function seedGrammarPoint(
  em: EntityManager,
): Promise<{ point: GrammarUsagePoint; slug: string }> {
  const category = em.create(GrammarCategory, {
    name: `PRESENT-${uuidv7()}`,
    sortOrder: 1,
  });
  const slug = `present-simple-${uuidv7()}`;
  const construction = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'Present simple',
    slug,
    sortOrder: 1,
  });
  const point = em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    cefrLevel: CefrLevel.A1,
    guideword: 'USE: HABITS AND GENERAL FACTS',
    canDoStatement: 'Can talk about habits.',
    exampleText: 'I walk to work every day.',
  });
  await em.flush();
  return { point, slug };
}

function seedRead(
  em: EntityManager,
  userId: string,
  postId: string,
  readAt: DateTime,
): void {
  em.create(PostRead, { userId, postId, readAt });
}

describe('GetPracticeQueueHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns only due cards, soonest first, with resolved display text', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const word = em.create(Word, { lemma: 'ephemeral' });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Adjective,
    });
    const phrase = em.create(Phrase, { phraseText: 'pick up' });
    const grammar = em.create(GrammarUsagePoint, {
      constructionId: uuidv7(),
      cefrLevel: CefrLevel.B1,
      guideword: 'past perfect',
      canDoStatement: 'Can talk about an earlier past.',
    });
    await em.flush();

    card(em, userId, DateTime.now().minus({ days: 2 }), {
      wordDefinitionId: definition.id,
    });
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      phraseId: phrase.id,
    });
    card(em, userId, DateTime.now().plus({ days: 1 }), {
      grammarUsagePointId: grammar.id,
    });
    await em.flush();
    em.clear();

    const { items: queue } = await suite.query(
      new GetPracticeQueueQuery(userId, 20),
    );

    expect(queue.map((item) => item.target.type)).toEqual(['word', 'phrase']);
    expect(queue[0].target.primary).toBe('ephemeral');
    expect(queue[1].target.primary).toBe('pick up');
  });

  it('caps the queue at the requested limit', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const definitions = Array.from({ length: 5 }, () => {
      const word = em.create(Word, { lemma: `w-${uuidv7()}` });
      return em.create(WordDefinition, {
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
    });
    await em.flush();

    definitions.forEach((definition, i) => {
      card(em, userId, DateTime.now().minus({ minutes: i + 1 }), {
        wordDefinitionId: definition.id,
      });
    });
    await em.flush();
    em.clear();

    const { items: queue } = await suite.query(
      new GetPracticeQueueQuery(userId, 3),
    );
    expect(queue).toHaveLength(3);
  });

  it('throttles New cards to the daily limit but never caps due reviews, and reports the holdback', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const newDefinitions = Array.from(
      { length: DAILY_NEW_CARD_LIMIT + 3 },
      () => {
        const word = em.create(Word, { lemma: `new-${uuidv7()}` });
        return em.create(WordDefinition, {
          wordId: word.id,
          pos: PartOfSpeech.Noun,
        });
      },
    );
    const reviewDefinition = (() => {
      const word = em.create(Word, { lemma: `review-${uuidv7()}` });
      return em.create(WordDefinition, {
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
    })();
    await em.flush();

    newDefinitions.forEach((definition, i) => {
      card(em, userId, DateTime.now().minus({ minutes: i + 1 }), {
        wordDefinitionId: definition.id,
      });
    });
    card(
      em,
      userId,
      DateTime.now().minus({ days: 1 }),
      { wordDefinitionId: reviewDefinition.id },
      LearningCardState.Review,
    );
    await em.flush();
    em.clear();

    const { items, heldBackNewCount } = await suite.query(
      new GetPracticeQueueQuery(userId, 50),
    );

    expect(items.filter((i) => i.state === LearningCardState.New)).toHaveLength(
      DAILY_NEW_CARD_LIMIT,
    );
    expect(
      items.filter((i) => i.state === LearningCardState.Review),
    ).toHaveLength(1);
    expect(heldBackNewCount).toBe(3);
  });

  it('bypassNewLimit skips the daily cap and reports no holdback', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const definitions = Array.from({ length: DAILY_NEW_CARD_LIMIT + 3 }, () => {
      const word = em.create(Word, { lemma: `w-${uuidv7()}` });
      return em.create(WordDefinition, {
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
    });
    await em.flush();

    definitions.forEach((definition, i) => {
      card(em, userId, DateTime.now().minus({ minutes: i + 1 }), {
        wordDefinitionId: definition.id,
      });
    });
    await em.flush();
    em.clear();

    const { items, heldBackNewCount } = await suite.query(
      new GetPracticeQueueQuery(userId, 50, true),
    );

    expect(items).toHaveLength(DAILY_NEW_CARD_LIMIT + 3);
    expect(heldBackNewCount).toBe(0);
  });

  it("persists today's spent budget across calls instead of resetting per fetch", async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    // Simulate cards that already graduated from New earlier today — their
    // earliest review_logs row is today, so they count against today's
    // budget even though they're no longer due (and so never appear in this
    // response themselves).
    const alreadyIntroduced = DAILY_NEW_CARD_LIMIT - 2;
    for (let i = 0; i < alreadyIntroduced; i += 1) {
      const word = em.create(Word, { lemma: `spent-${uuidv7()}` });
      const definition = em.create(WordDefinition, {
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
      const graduated = em.create(LearningCard, {
        userId,
        wordDefinitionId: definition.id,
        due: DateTime.now().plus({ days: 1 }),
        stability: 1,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: LearningCardState.Review,
        lastReview: DateTime.now(),
      });
      em.create(ReviewLog, {
        cardId: graduated.id,
        rating: ReviewRating.Good,
        reviewedAt: DateTime.now(),
        elapsedDays: 0,
        scheduledDays: 1,
      });
    }
    await em.flush();

    const freshDefinitions = Array.from({ length: 5 }, () => {
      const word = em.create(Word, { lemma: `fresh-${uuidv7()}` });
      return em.create(WordDefinition, {
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
    });
    await em.flush();
    freshDefinitions.forEach((definition, i) => {
      card(em, userId, DateTime.now().minus({ minutes: i + 1 }), {
        wordDefinitionId: definition.id,
      });
    });
    await em.flush();
    em.clear();

    const { items, heldBackNewCount } = await suite.query(
      new GetPracticeQueueQuery(userId, 50),
    );

    expect(items.filter((i) => i.state === LearningCardState.New)).toHaveLength(
      2,
    );
    expect(heldBackNewCount).toBe(3);
  });

  it('excludes archived cards from the queue', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const word = em.create(Word, { lemma: `w-${uuidv7()}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();

    em.create(LearningCard, {
      userId,
      wordDefinitionId: definition.id,
      due: DateTime.now().minus({ days: 1 }),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 1,
      lapses: 0,
      state: LearningCardState.Learning,
      archivedAt: DateTime.now(),
    });
    await em.flush();
    em.clear();

    const { items: queue } = await suite.query(
      new GetPracticeQueueQuery(userId, 20),
    );
    expect(queue).toHaveLength(0);
  });

  it('resolves a word target from WordDefinition instead of hardcoded null', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const word = em.create(Word, { lemma: `w-${uuidv7()}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Adjective,
      definition: 'lasting a very short time',
      phonetic: '/ɪˈfemərəl/',
    });
    await em.flush();
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      wordDefinitionId: definition.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.secondary).toBe('lasting a very short time');
    expect(item.target.phonetic).toBe('/ɪˈfemərəl/');
  });

  it('resolves a phrase target definition, with no phonetic', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const phrase = em.create(Phrase, {
      phraseText: 'give up',
      definition: 'to stop trying',
    });
    await em.flush();
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      phraseId: phrase.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.secondary).toBe('to stop trying');
    expect(item.target.phonetic).toBeNull();
  });

  it('finds a real context sentence for a word from a recently read post', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const word = em.create(Word, { lemma: `w-${uuidv7()}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();
    const postId = await seedPostWithWordSpan(
      em,
      definition.id,
      'The sunset was ephemeral.',
    );
    seedRead(em, userId, postId, DateTime.now());
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      wordDefinitionId: definition.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.contextSentence).toBe('The sunset was ephemeral.');
  });

  it('finds a real context sentence for a phrase from a recently read post', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const phrase = em.create(Phrase, { phraseText: 'give up' });
    await em.flush();
    const postId = await seedPostWithPhraseSpan(
      em,
      phrase.id,
      'Never give up on your goals.',
    );
    seedRead(em, userId, postId, DateTime.now());
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      phraseId: phrase.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.contextSentence).toBe('Never give up on your goals.');
  });

  it('leaves contextSentence null with no fallback when nothing is found', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const word = em.create(Word, { lemma: `w-${uuidv7()}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      exampleSentence: 'An AI-written example that must not leak through.',
    });
    await em.flush();
    // Read a post, but it doesn't mention this word at all.
    const otherWord = em.create(Word, { lemma: `other-${uuidv7()}` });
    const otherDefinition = em.create(WordDefinition, {
      wordId: otherWord.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();
    const postId = await seedPostWithWordSpan(
      em,
      otherDefinition.id,
      'Something unrelated.',
    );
    seedRead(em, userId, postId, DateTime.now());
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      wordDefinitionId: definition.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.contextSentence).toBeNull();
  });

  it('only searches the last 3 distinct read posts, most recent first', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const word = em.create(Word, { lemma: `w-${uuidv7()}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();

    // The 4th-most-recent read is the only one that mentions the word.
    const stalePostId = await seedPostWithWordSpan(
      em,
      definition.id,
      'This one should never be reached.',
    );
    seedRead(em, userId, stalePostId, DateTime.now().minus({ days: 4 }));

    const fillerDefinitions = Array.from({ length: 3 }, () => {
      const otherWord = em.create(Word, { lemma: `filler-${uuidv7()}` });
      return em.create(WordDefinition, {
        wordId: otherWord.id,
        pos: PartOfSpeech.Noun,
      });
    });
    await em.flush();

    for (const [i, otherDefinition] of fillerDefinitions.entries()) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — seedPostWithWordSpan flushes internally on the shared `em`.
      const postId = await seedPostWithWordSpan(
        em,
        otherDefinition.id,
        `Filler post ${i}.`,
      );
      seedRead(em, userId, postId, DateTime.now().minus({ days: i }));
    }

    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      wordDefinitionId: definition.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.contextSentence).toBeNull();
  });

  it('resolves a grammar target with kicker, example and detail slug', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const { point, slug } = await seedGrammarPoint(em);
    const category = await em.findOneOrFail(GrammarCategory, {
      id: (await em.findOneOrFail(GrammarConstruction, { slug })).categoryId,
    });
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      grammarUsagePointId: point.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target).toMatchObject({
      type: 'grammar',
      primary: 'USE: HABITS AND GENERAL FACTS',
      secondary: 'Can talk about habits.',
      kicker: `${category.name} · Present simple`,
      exampleText: 'I walk to work every day.',
      detailSlug: slug,
      contextSentence: null,
    });
  });

  it('leaves grammar kicker and slug null when the construction row is missing', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const point = em.create(GrammarUsagePoint, {
      constructionId: uuidv7(),
      cefrLevel: CefrLevel.B1,
      guideword: 'past perfect',
      canDoStatement: 'Can talk about an earlier past.',
    });
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      grammarUsagePointId: point.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.kicker).toBeNull();
    expect(item.target.detailSlug).toBeNull();
    expect(item.target.exampleText).toBeNull();
  });

  it('finds a real context sentence for grammar via grammar_matches, most recent read first', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const { point } = await seedGrammarPoint(em);

    const olderPostId = await seedPostWithGrammarMatch(
      em,
      point.id,
      'She works here every day.',
      0.99,
    );
    const newerPostId = await seedPostWithGrammarMatch(
      em,
      point.id,
      'He plays tennis on Sundays.',
      0.5,
    );
    seedRead(em, userId, olderPostId, DateTime.now().minus({ days: 2 }));
    seedRead(em, userId, newerPostId, DateTime.now().minus({ days: 1 }));
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      grammarUsagePointId: point.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.contextSentence).toBe('He plays tennis on Sundays.');
  });

  it('leaves grammar contextSentence null with no fallback when no match is in the last 3 reads', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const { point } = await seedGrammarPoint(em);
    const { point: otherPoint } = await seedGrammarPoint(em);

    // Matched, but never read by this user.
    await seedPostWithGrammarMatch(em, point.id, 'Unread sentence.');
    // Read, but matches a different usage point.
    const readPostId = await seedPostWithGrammarMatch(
      em,
      otherPoint.id,
      'Read sentence about something else.',
    );
    seedRead(em, userId, readPostId, DateTime.now());
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      grammarUsagePointId: point.id,
    });
    await em.flush();
    em.clear();

    const [item] = (await suite.query(new GetPracticeQueueQuery(userId, 20)))
      .items;

    expect(item.target.contextSentence).toBeNull();
  });
});
