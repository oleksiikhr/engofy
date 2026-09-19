import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { User } from '../../../auth/entities/user.entity.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
import { Sentence } from '../../../post/entities/sentence.entity.js';
import { SentenceToken } from '../../../post/entities/sentence-token.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PhraseType } from '../../../post/enums/phrase-type.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { PostSourceType } from '../../../post/enums/post-source-type.enum.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { EffectiveState } from '../../domain/resolve-effective-state.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { Disposition } from '../../enums/disposition.enum.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetPhraseDictionaryDetailQuery } from './get-phrase-dictionary-detail.query.js';

async function seedUser(
  em: EntityManager,
  cefrLevel: CefrLevel = CefrLevel.B1,
): Promise<User> {
  const user = em.create(User, {
    email: `${uuidv7()}@example.com`,
    cefrLevel,
  });
  await em.flush();
  return user;
}

function uniquePhrase(em: EntityManager, overrides: Partial<Phrase> = {}) {
  return em.create(Phrase, {
    phraseText: `at loose ends ${uuidv7().slice(0, 6)}`,
    ...overrides,
  });
}

function postLinking(
  em: EntityManager,
  opts: { status: PostStatus; phraseId: string },
): Post {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.type = PostSourceType.Original;
  source.rawText = 'seed';
  source.attributionText = 'Original content';

  const post = new Post();
  post.source = source;
  post.title = `post-${uuidv7().slice(0, 6)}`;
  post.status = opts.status;
  em.persist(post);

  const sentence = em.create(Sentence, {
    postId: post.id,
    postPartId: uuidv7(),
    unitIndex: 0,
    position: 0,
    rawText: 'x term y',
    charStart: 0,
    charEnd: 8,
  });
  em.create(SentenceToken, {
    sentenceId: sentence.id,
    position: 0,
    text: 'term',
    charStart: 0,
    charEnd: 4,
    lemma: 'term',
    pos: 'NOUN',
    tag: 'NN',
    dep: 'nsubj',
    morph: {},
    phraseId: opts.phraseId,
  });
  return post;
}

describe('GetPhraseDictionaryDetailHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns null for an unknown phrase', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(`nope ${uuidv7()}`, userId),
    );
    expect(view).toBeNull();
  });

  it('is case-insensitive on the phrase lookup and returns the phrase fields', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const phrase = uniquePhrase(em, {
      type: PhraseType.Idiom,
      definition: 'having nothing particular to do',
      exampleSentence: 'She was at loose ends all week.',
      cefrLevel: CefrLevel.C1,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(
        phrase.phraseText.toUpperCase(),
        userId,
      ),
    );
    expect(view).toMatchObject({
      phraseId: phrase.id,
      phraseText: phrase.phraseText,
      type: PhraseType.Idiom,
      definition: 'having nothing particular to do',
      example: 'She was at loose ends all week.',
      cefrLevel: CefrLevel.C1,
      // No card, no disposition, C1 > the learner's B1 default.
      state: EffectiveState.New,
      cardId: null,
      posts: [],
    });
  });

  it('surfaces the active card id and Learning state', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const phrase = uniquePhrase(em, { cefrLevel: CefrLevel.C1 });
    await em.flush();
    const card = em.create(LearningCard, {
      userId,
      phraseId: phrase.id,
      due: DateTime.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: LearningCardState.Learning,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(phrase.phraseText, userId),
    );
    expect(view).toMatchObject({
      state: EffectiveState.Learning,
      cardId: card.id,
    });
  });

  it('ignores an archived card and reflects the disposition instead', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const phrase = uniquePhrase(em, { cefrLevel: CefrLevel.C1 });
    await em.flush();
    em.create(LearningCard, {
      userId,
      phraseId: phrase.id,
      due: DateTime.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: LearningCardState.Review,
      archivedAt: DateTime.now(),
    });
    em.create(LearningDisposition, {
      userId,
      phraseId: phrase.id,
      disposition: Disposition.Known,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(phrase.phraseText, userId),
    );
    expect(view).toMatchObject({ state: EffectiveState.Learned, cardId: null });
  });

  it('reflects a skipped disposition with no active card', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const phrase = uniquePhrase(em, { cefrLevel: CefrLevel.C1 });
    await em.flush();
    em.create(LearningDisposition, {
      userId,
      phraseId: phrase.id,
      disposition: Disposition.Skipped,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(phrase.phraseText, userId),
    );
    expect(view).toMatchObject({ state: EffectiveState.Skipped, cardId: null });
  });

  it('folds the CEFR default into an unsaved phrase at or below the learner level', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em, CefrLevel.B2)).id;
    const phrase = uniquePhrase(em, { cefrLevel: CefrLevel.A1 });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(phrase.phraseText, userId),
    );
    expect(view).toMatchObject({ state: EffectiveState.Learned, cardId: null });
  });

  it("does not leak another learner's card or disposition", async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const otherId = (await seedUser(em)).id;
    const phrase = uniquePhrase(em, { cefrLevel: CefrLevel.C1 });
    await em.flush();
    em.create(LearningDisposition, {
      userId: otherId,
      phraseId: phrase.id,
      disposition: Disposition.Skipped,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(phrase.phraseText, userId),
    );
    expect(view).toMatchObject({ state: EffectiveState.New, cardId: null });
  });

  it('lists published posts using the phrase, newest first, with a per-user read flag', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const phrase = uniquePhrase(em);
    await em.flush();

    const older = postLinking(em, {
      status: PostStatus.Published,
      phraseId: phrase.id,
    });
    const newer = postLinking(em, {
      status: PostStatus.Published,
      phraseId: phrase.id,
    });
    postLinking(em, { status: PostStatus.Pending, phraseId: phrase.id });
    await em.flush();

    older.publishedAt = DateTime.now().minus({ days: 1 });
    newer.publishedAt = DateTime.now();
    await em.flush();

    em.create(PostRead, {
      userId,
      postId: older.id,
      readAt: DateTime.now(),
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPhraseDictionaryDetailQuery(phrase.phraseText, userId),
    );
    expect(view?.posts).toEqual([
      { shortId: newer.shortId, slug: null, title: newer.title, isRead: false },
      { shortId: older.shortId, slug: null, title: older.title, isRead: true },
    ]);
  });
});
