import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { GrammarMatch } from '../../../post/entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { Sentence } from '../../../post/entities/sentence.entity.js';
import { SentenceToken } from '../../../post/entities/sentence-token.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { DAILY_NEW_CARD_LIMIT } from '../../domain/daily-new-card-limit.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetDuePostCardsQuery } from './get-due-post-cards.query.js';

function seedPost(em: EntityManager): Post {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'seed';
  const post = new Post();
  post.source = source;
  post.title = `post-${uuidv7().slice(0, 6)}`;
  em.persist(post);
  return post;
}

function seedSentence(em: EntityManager, postId: string): Sentence {
  return em.create(Sentence, {
    postId,
    postPartId: uuidv7(),
    unitIndex: 0,
    position: 0,
    rawText: 'x term y',
    charStart: 0,
    charEnd: 8,
  });
}

function seedToken(
  em: EntityManager,
  sentenceId: string,
  opts: { wordId?: string; phraseId?: string },
): void {
  em.create(SentenceToken, {
    sentenceId,
    position: 0,
    text: 'term',
    charStart: 0,
    charEnd: 4,
    lemma: 'term',
    pos: 'NOUN',
    tag: 'NN',
    dep: 'nsubj',
    morph: {},
    wordId: opts.wordId ?? null,
    phraseId: opts.phraseId ?? null,
  });
}

function seedGrammarMatch(
  em: EntityManager,
  sentenceId: string,
  grammarUsagePointId: string,
): void {
  em.create(GrammarMatch, {
    sentenceId,
    grammarUsagePointId,
    tokenStart: 0,
    tokenEnd: 1,
  });
}

function seedCard(
  em: EntityManager,
  userId: string,
  opts: {
    wordDefinitionId?: string | null;
    phraseId?: string | null;
    grammarUsagePointId?: string | null;
    due?: DateTime;
    state?: LearningCardState;
    archivedAt?: DateTime | null;
  },
): LearningCard {
  return em.create(LearningCard, {
    userId,
    wordDefinitionId: opts.wordDefinitionId ?? null,
    phraseId: opts.phraseId ?? null,
    grammarUsagePointId: opts.grammarUsagePointId ?? null,
    due: opts.due ?? DateTime.now(),
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: opts.state ?? LearningCardState.New,
    archivedAt: opts.archivedAt ?? null,
  });
}

async function seedWordInPost(
  em: EntityManager,
  postId: string,
): Promise<{ wordId: string; wordDefinitionId: string }> {
  const { wordId, wordDefinitionId } = createWordInPost(em, postId);
  await em.flush();
  return { wordId, wordDefinitionId };
}

// Same as `seedWordInPost` but defers the flush to the caller — lets a batch
// of these be built without an `await` per iteration.
function createWordInPost(
  em: EntityManager,
  postId: string,
): { wordId: string; wordDefinitionId: string } {
  const word = em.create(Word, { lemma: `w-${uuidv7()}` });
  const definition = em.create(WordDefinition, {
    wordId: word.id,
    pos: PartOfSpeech.Noun,
  });
  const sentence = seedSentence(em, postId);
  seedToken(em, sentence.id, { wordId: word.id });
  return { wordId: word.id, wordDefinitionId: definition.id };
}

describe('GetDuePostCardsHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns nothing when the post has no linked spaCy layer at all', async () => {
    const em = suite.orm.em;
    const post = seedPost(em);
    await em.flush();

    const items = await suite.query(
      new GetDuePostCardsQuery(post.id, uuidv7()),
    );
    expect(items).toEqual([]);
  });

  it('includes a due word card whose word occurs in the post', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const post = seedPost(em);
    await em.flush();
    const { wordDefinitionId } = await seedWordInPost(em, post.id);
    seedCard(em, userId, { wordDefinitionId });
    await em.flush();
    em.clear();

    const items = await suite.query(new GetDuePostCardsQuery(post.id, userId));
    expect(items).toHaveLength(1);
    expect(items[0].target.type).toBe('word');
  });

  it('excludes a due word card whose word does not occur in the post', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const post = seedPost(em);
    await em.flush();
    await seedWordInPost(em, post.id);

    const word = em.create(Word, { lemma: `other-${uuidv7()}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();
    seedCard(em, userId, { wordDefinitionId: definition.id });
    await em.flush();
    em.clear();

    const items = await suite.query(new GetDuePostCardsQuery(post.id, userId));
    expect(items).toEqual([]);
  });

  it('includes a due phrase card whose phrase occurs in the post', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const post = seedPost(em);
    const phrase = em.create(Phrase, { phraseText: 'set sail' });
    await em.flush();
    const sentence = seedSentence(em, post.id);
    await em.flush();
    seedToken(em, sentence.id, { phraseId: phrase.id });
    seedCard(em, userId, { phraseId: phrase.id });
    await em.flush();
    em.clear();

    const items = await suite.query(new GetDuePostCardsQuery(post.id, userId));
    expect(items).toHaveLength(1);
    expect(items[0].target).toMatchObject({
      type: 'phrase',
      primary: 'set sail',
    });
  });

  it('includes a due grammar card whose usage point is matched in the post', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const post = seedPost(em);
    await em.flush();
    const sentence = seedSentence(em, post.id);
    await em.flush();
    const usagePoint = em.create(GrammarUsagePoint, {
      constructionId: uuidv7(),
      cefrLevel: CefrLevel.A1,
      guideword: 'present perfect',
      canDoStatement: 'x',
    });
    await em.flush();
    seedGrammarMatch(em, sentence.id, usagePoint.id);
    seedCard(em, userId, { grammarUsagePointId: usagePoint.id });
    await em.flush();
    em.clear();

    const items = await suite.query(new GetDuePostCardsQuery(post.id, userId));
    expect(items).toHaveLength(1);
    expect(items[0].target).toMatchObject({
      type: 'grammar',
      primary: 'present perfect',
    });
  });

  it('excludes archived and not-yet-due cards', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const post = seedPost(em);
    await em.flush();
    const { wordDefinitionId: archived } = await seedWordInPost(em, post.id);
    const { wordDefinitionId: notDue } = await seedWordInPost(em, post.id);
    seedCard(em, userId, {
      wordDefinitionId: archived,
      archivedAt: DateTime.now(),
    });
    seedCard(em, userId, {
      wordDefinitionId: notDue,
      due: DateTime.now().plus({ days: 1 }),
    });
    await em.flush();
    em.clear();

    const items = await suite.query(new GetDuePostCardsQuery(post.id, userId));
    expect(items).toEqual([]);
  });

  it('caps New cards at DAILY_NEW_CARD_LIMIT but never caps Review cards', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const post = seedPost(em);
    await em.flush();

    for (let i = 0; i < DAILY_NEW_CARD_LIMIT + 3; i += 1) {
      const { wordDefinitionId } = createWordInPost(em, post.id);
      seedCard(em, userId, { wordDefinitionId, state: LearningCardState.New });
    }
    const { wordDefinitionId: reviewTarget } = createWordInPost(em, post.id);
    seedCard(em, userId, {
      wordDefinitionId: reviewTarget,
      state: LearningCardState.Review,
    });
    await em.flush();
    em.clear();

    const items = await suite.query(new GetDuePostCardsQuery(post.id, userId));
    const newItems = items.filter((i) => i.state === LearningCardState.New);
    const reviewItems = items.filter(
      (i) => i.state === LearningCardState.Review,
    );
    expect(newItems).toHaveLength(DAILY_NEW_CARD_LIMIT);
    expect(reviewItems).toHaveLength(1);
  });
});
