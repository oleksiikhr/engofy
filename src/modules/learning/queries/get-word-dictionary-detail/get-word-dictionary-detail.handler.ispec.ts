import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { User } from '../../../auth/entities/user.entity.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
import { Sentence } from '../../../post/entities/sentence.entity.js';
import { SentenceToken } from '../../../post/entities/sentence-token.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { PostSourceType } from '../../../post/enums/post-source-type.enum.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { EffectiveState } from '../../domain/resolve-effective-state.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { Disposition } from '../../enums/disposition.enum.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetWordDictionaryDetailQuery } from './get-word-dictionary-detail.query.js';

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

function postLinking(
  em: EntityManager,
  opts: { status: PostStatus; wordId: string },
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
    wordId: opts.wordId,
  });
  return post;
}

describe('GetWordDictionaryDetailHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns null for an unknown lemma', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const view = await suite.query(
      new GetWordDictionaryDetailQuery(`nope-${uuidv7()}`, userId),
    );
    expect(view).toBeNull();
  });

  it('is case-insensitive on the lemma lookup', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `Harbour-${uuidv7().slice(0, 6)}` });
    await em.flush();

    const view = await suite.query(
      new GetWordDictionaryDetailQuery(word.lemma.toUpperCase(), userId),
    );
    expect(view?.lemma).toBe(word.lemma);
  });

  it('lists every sense with per-sense effective state, including unsaved senses', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `bank-${uuidv7().slice(0, 6)}` });
    const nounDef = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'a financial institution',
      cefrLevel: CefrLevel.A2,
    });
    em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Verb,
      definition: 'to tilt an aircraft',
      cefrLevel: CefrLevel.C1,
    });
    await em.flush();

    // Noun sense has an active card; verb sense was never saved at all.
    const card = em.create(LearningCard, {
      userId,
      wordDefinitionId: nounDef.id,
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
      new GetWordDictionaryDetailQuery(word.lemma, userId),
    );
    expect(view?.senses).toHaveLength(2);
    const noun = view?.senses.find((s) => s.pos === PartOfSpeech.Noun);
    const verb = view?.senses.find((s) => s.pos === PartOfSpeech.Verb);
    expect(noun).toMatchObject({
      state: EffectiveState.Learning,
      cardId: card.id,
      definition: 'a financial institution',
    });
    // No card, no disposition, C1 > the learner's B1 default -> New.
    expect(verb).toMatchObject({ state: EffectiveState.New, cardId: null });
  });

  it('folds the CEFR default into an unsaved sense at or below the learner level', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em, CefrLevel.B2)).id;
    const word = em.create(Word, { lemma: `easy-${uuidv7().slice(0, 6)}` });
    em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Adjective,
      cefrLevel: CefrLevel.A1,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetWordDictionaryDetailQuery(word.lemma, userId),
    );
    expect(view?.senses[0]).toMatchObject({
      state: EffectiveState.Learned,
      cardId: null,
    });
  });

  it('reflects a skipped disposition with no active card', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `skip-${uuidv7().slice(0, 6)}` });
    const def = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();
    em.create(LearningDisposition, {
      userId,
      wordDefinitionId: def.id,
      disposition: Disposition.Skipped,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetWordDictionaryDetailQuery(word.lemma, userId),
    );
    expect(view?.senses[0]).toMatchObject({
      state: EffectiveState.Skipped,
      cardId: null,
    });
  });

  it('attaches irregular-verb forms for a known base form', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    // "go" is in the bundled assets/irregular-verbs.json.
    em.create(Word, { lemma: 'go' });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetWordDictionaryDetailQuery('go', userId),
    );
    expect(view?.irregularVerb).toEqual({
      pastSimple: ['went'],
      pastParticiple: ['gone'],
    });
  });

  it('returns null irregularVerb for a regular lemma', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `regular-${uuidv7().slice(0, 6)}` });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetWordDictionaryDetailQuery(word.lemma, userId),
    );
    expect(view?.irregularVerb).toBeNull();
  });

  it('lists published posts using the word, newest first, with a per-user read flag', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `tide-${uuidv7().slice(0, 6)}` });
    await em.flush();

    const older = postLinking(em, {
      status: PostStatus.Published,
      wordId: word.id,
    });
    const newer = postLinking(em, {
      status: PostStatus.Published,
      wordId: word.id,
    });
    postLinking(em, { status: PostStatus.Pending, wordId: word.id });
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
      new GetWordDictionaryDetailQuery(word.lemma, userId),
    );
    expect(view?.posts).toEqual([
      { shortId: newer.shortId, slug: null, title: newer.title, isRead: false },
      { shortId: older.shortId, slug: null, title: older.title, isRead: true },
    ]);
  });
});
