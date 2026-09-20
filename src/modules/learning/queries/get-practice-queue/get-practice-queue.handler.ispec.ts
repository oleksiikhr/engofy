import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { makeGrammarUsagePoint } from '../../../../../test/helpers/reference-data.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { GrammarCategory } from '../../../post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { PostPartKind } from '../../../post/enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { DAILY_NEW_CARD_LIMIT } from '../../domain/daily-new-card-limit.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
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
  factories(em).learningCard.makeOne({
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
  const post = factories(em).post.makeOne({
    source: { format: PostSourceFormat.Text, rawText: rawText },
  });

  const part = factories(em).postPart.makeOne({
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
  factories(em).sentence.makeOne({
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
  const post = factories(em).post.makeOne({
    source: { format: PostSourceFormat.Text, rawText: rawText },
  });

  const part = factories(em).postPart.makeOne({
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [{ type: 'span', kind: 'phrase', text: rawText, phraseId }],
    },
  });
  factories(em).sentence.makeOne({
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
  const post = factories(em).post.makeOne({
    source: { format: PostSourceFormat.Text, rawText: rawText },
  });

  const part = factories(em).postPart.makeOne({
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: { type: 'paragraph', children: [{ type: 'text', text: rawText }] },
  });
  const sentence = factories(em).sentence.makeOne({
    postId: post.id,
    postPartId: part.id,
    unitIndex: 0,
    position: 0,
    rawText,
    charStart: 0,
    charEnd: rawText.length,
  });
  factories(em).grammarMatch.makeOne({
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
  const category = factories(em).grammarCategory.makeOne({
    name: `PRESENT-${uuidv7()}`,
    sortOrder: 1,
  });
  const slug = `present-simple-${uuidv7()}`;
  const construction = factories(em).grammarConstruction.makeOne({
    categoryId: category.id,
    name: 'Present simple',
    slug,
    sortOrder: 1,
  });
  const point = factories(em).grammarUsagePoint.makeOne({
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
  factories(em).postRead.makeOne({ userId, postId, readAt });
}

describe('GetPracticeQueueHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns only due cards, soonest first, with resolved display text', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;

    const word = factories(em).word.makeOne({ lemma: 'ephemeral' });
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Adjective,
    });
    const phrase = factories(em).phrase.makeOne({ phraseText: 'pick up' });
    const grammar = makeGrammarUsagePoint(factories(em), {
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
    const userId = (await suite.factories.user.createOne()).id;

    const definitions = Array.from({ length: 5 }, () => {
      const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
      return factories(em).wordDefinition.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;

    const newDefinitions = Array.from(
      { length: DAILY_NEW_CARD_LIMIT + 3 },
      () => {
        const word = factories(em).word.makeOne({ lemma: `new-${uuidv7()}` });
        return factories(em).wordDefinition.makeOne({
          wordId: word.id,
          pos: PartOfSpeech.Noun,
        });
      },
    );
    const reviewDefinition = (() => {
      const word = factories(em).word.makeOne({ lemma: `review-${uuidv7()}` });
      return factories(em).wordDefinition.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;

    const definitions = Array.from({ length: DAILY_NEW_CARD_LIMIT + 3 }, () => {
      const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
      return factories(em).wordDefinition.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;

    // Simulate cards that already graduated from New earlier today — their
    // earliest review_logs row is today, so they count against today's
    // budget even though they're no longer due (and so never appear in this
    // response themselves).
    const alreadyIntroduced = DAILY_NEW_CARD_LIMIT - 2;
    for (let i = 0; i < alreadyIntroduced; i += 1) {
      const word = factories(em).word.makeOne({ lemma: `spent-${uuidv7()}` });
      const definition = factories(em).wordDefinition.makeOne({
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
      const graduated = factories(em).learningCard.makeOne({
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
      factories(em).reviewLog.makeOne({
        cardId: graduated.id,
        rating: ReviewRating.Good,
        reviewedAt: DateTime.now(),
        elapsedDays: 0,
        scheduledDays: 1,
      });
    }
    await em.flush();

    const freshDefinitions = Array.from({ length: 5 }, () => {
      const word = factories(em).word.makeOne({ lemma: `fresh-${uuidv7()}` });
      return factories(em).wordDefinition.makeOne({
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

  it('puts in-progress cards ahead of New ones even when the New cards are due earlier', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;

    const definitions = Array.from({ length: 3 }, () => {
      const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
      return factories(em).wordDefinition.makeOne({
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
    });
    await em.flush();

    card(em, userId, DateTime.now().minus({ days: 5 }), {
      wordDefinitionId: definitions[0].id,
    });
    card(
      em,
      userId,
      DateTime.now().minus({ hours: 2 }),
      { wordDefinitionId: definitions[1].id },
      LearningCardState.Review,
    );
    card(
      em,
      userId,
      DateTime.now().minus({ hours: 1 }),
      { wordDefinitionId: definitions[2].id },
      LearningCardState.Relearning,
    );
    await em.flush();
    em.clear();

    const { items } = await suite.query(new GetPracticeQueueQuery(userId, 20));
    expect(items.map((item) => item.state)).toEqual([
      LearningCardState.Review,
      LearningCardState.Relearning,
      LearningCardState.New,
    ]);

    // A tight limit fills with the in-progress cards first, not the older New one.
    const { items: limited } = await suite.query(
      new GetPracticeQueueQuery(userId, 2),
    );
    expect(limited.map((item) => item.state)).toEqual([
      LearningCardState.Review,
      LearningCardState.Relearning,
    ]);
  });

  it('filters the queue to the requested card types', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;

    const word = factories(em).word.makeOne({ lemma: 'ephemeral' });
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Adjective,
    });
    const phrase = factories(em).phrase.makeOne({ phraseText: 'pick up' });
    const grammar = makeGrammarUsagePoint(factories(em), {
      cefrLevel: CefrLevel.B1,
      guideword: 'past perfect',
      canDoStatement: 'Can talk about an earlier past.',
    });
    await em.flush();

    card(em, userId, DateTime.now().minus({ hours: 3 }), {
      wordDefinitionId: definition.id,
    });
    card(em, userId, DateTime.now().minus({ hours: 2 }), {
      phraseId: phrase.id,
    });
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      grammarUsagePointId: grammar.id,
    });
    await em.flush();
    em.clear();

    const both = await suite.query(
      new GetPracticeQueueQuery(userId, 20, false, ['phrase', 'grammar']),
    );
    expect(both.items.map((item) => item.target.type)).toEqual([
      'phrase',
      'grammar',
    ]);

    const wordsOnly = await suite.query(
      new GetPracticeQueueQuery(userId, 20, false, ['word']),
    );
    expect(wordsOnly.items.map((item) => item.target.type)).toEqual(['word']);
  });

  it('reports hasAnyCards separately from what is due or matches the filter', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;

    const empty = await suite.query(new GetPracticeQueueQuery(userId, 20));
    expect(empty).toMatchObject({ items: [], hasAnyCards: false });

    const word = factories(em).word.makeOne({ lemma: 'later' });
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Adjective,
    });
    await em.flush();
    card(em, userId, DateTime.now().plus({ days: 3 }), {
      wordDefinitionId: definition.id,
    });
    await em.flush();
    em.clear();

    // Owns a card, but nothing is due: cleared, not empty.
    const cleared = await suite.query(new GetPracticeQueueQuery(userId, 20));
    expect(cleared).toMatchObject({ items: [], hasAnyCards: true });

    const filtered = await suite.query(
      new GetPracticeQueueQuery(userId, 20, false, ['grammar']),
    );
    expect(filtered).toMatchObject({ items: [], hasAnyCards: true });
  });

  it('excludes archived cards from the queue', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;
    const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();

    factories(em).learningCard.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;
    const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = factories(em).wordDefinition.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;
    const phrase = factories(em).phrase.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;
    const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = factories(em).wordDefinition.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;
    const phrase = factories(em).phrase.makeOne({ phraseText: 'give up' });
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
    const userId = (await suite.factories.user.createOne()).id;
    const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      exampleSentence: 'An AI-written example that must not leak through.',
    });
    await em.flush();
    // Read a post, but it doesn't mention this word at all.
    const otherWord = factories(em).word.makeOne({
      lemma: `other-${uuidv7()}`,
    });
    const otherDefinition = factories(em).wordDefinition.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;
    const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = factories(em).wordDefinition.makeOne({
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
      const otherWord = factories(em).word.makeOne({
        lemma: `filler-${uuidv7()}`,
      });
      return factories(em).wordDefinition.makeOne({
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
    const userId = (await suite.factories.user.createOne()).id;
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

  it('finds a real context sentence for grammar via grammar_matches, most recent read first', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;
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
    const userId = (await suite.factories.user.createOne()).id;
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
