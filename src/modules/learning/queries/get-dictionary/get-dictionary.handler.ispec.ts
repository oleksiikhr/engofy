import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { User } from '../../../auth/entities/user.entity.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
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
import { GetDictionaryQuery } from './get-dictionary.query.js';

async function seedUser(em: EntityManager): Promise<User> {
  const user = em.create(User, { email: `${uuidv7()}@example.com` });
  await em.flush();
  return user;
}

function card(
  em: EntityManager,
  userId: string,
  target: Partial<Pick<LearningCard, 'wordDefinitionId' | 'phraseId'>>,
  overrides: Partial<
    Pick<LearningCard, 'state' | 'scheduledDays' | 'due'>
  > = {},
): void {
  em.create(LearningCard, {
    userId,
    wordDefinitionId: target.wordDefinitionId ?? null,
    phraseId: target.phraseId ?? null,
    due: overrides.due ?? DateTime.now(),
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: overrides.scheduledDays ?? 0,
    reps: 0,
    lapses: 0,
    state: overrides.state ?? LearningCardState.New,
  });
}

function disposition(
  em: EntityManager,
  userId: string,
  target: Partial<Pick<LearningDisposition, 'wordDefinitionId' | 'phraseId'>>,
  value: Disposition,
): void {
  em.create(LearningDisposition, {
    userId,
    wordDefinitionId: target.wordDefinitionId ?? null,
    phraseId: target.phraseId ?? null,
    disposition: value,
  });
}

function postLinking(
  em: EntityManager,
  opts: { status: PostStatus; wordId?: string; phraseId?: string },
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
    wordId: opts.wordId ?? null,
    phraseId: opts.phraseId ?? null,
  });
  return post;
}

describe('GetDictionaryHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns nothing when the learner has no cards or dispositions', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const view = await suite.query(
      new GetDictionaryQuery(userId, { limit: 20 }),
    );
    expect(view).toEqual({ items: [], nextCursor: null });
  });

  it('excludes archived cards', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `w-${uuidv7()}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    await em.flush();
    em.create(LearningCard, {
      userId,
      wordDefinitionId: definition.id,
      due: DateTime.now(),
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

    const view = await suite.query(
      new GetDictionaryQuery(userId, { limit: 20 }),
    );
    expect(view.items).toEqual([]);
  });

  it('surfaces a disposition-only target (no active card) as learned/skipped', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const knownWord = em.create(Word, {
      lemma: `known-${uuidv7().slice(0, 6)}`,
    });
    const knownDef = em.create(WordDefinition, {
      wordId: knownWord.id,
      pos: PartOfSpeech.Adjective,
    });
    const skippedPhrase = em.create(Phrase, {
      phraseText: `skip-${uuidv7().slice(0, 6)}`,
    });
    await em.flush();

    disposition(
      em,
      userId,
      { wordDefinitionId: knownDef.id },
      Disposition.Known,
    );
    disposition(
      em,
      userId,
      { phraseId: skippedPhrase.id },
      Disposition.Skipped,
    );
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetDictionaryQuery(userId, { limit: 20 }),
    );
    expect(view.items).toHaveLength(2);
    expect(view.items.find((i) => i.primary === knownWord.lemma)).toMatchObject(
      { type: 'word', state: EffectiveState.Learned, senseCount: 1 },
    );
    expect(
      view.items.find((i) => i.primary === skippedPhrase.phraseText),
    ).toMatchObject({ type: 'phrase', state: EffectiveState.Skipped });
  });

  it('groups multiple saved senses of the same lemma into one entry', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `bank-${uuidv7().slice(0, 6)}` });
    const nounDef = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'a financial institution',
    });
    const verbDef = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Verb,
      definition: 'to tilt an aircraft',
    });
    await em.flush();

    // Noun sense is still being learned (active card); verb sense was marked
    // known (disposition only) — the "still learning" sense should win as
    // the group's representative.
    card(
      em,
      userId,
      { wordDefinitionId: nounDef.id },
      {
        state: LearningCardState.Learning,
        scheduledDays: 1,
      },
    );
    disposition(
      em,
      userId,
      { wordDefinitionId: verbDef.id },
      Disposition.Known,
    );
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetDictionaryQuery(userId, { limit: 20 }),
    );
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({
      type: 'word',
      primary: word.lemma,
      senseCount: 2,
      state: EffectiveState.Learning,
      secondary: PartOfSpeech.Noun,
      definition: 'a financial institution',
    });
  });

  it('filters by effective state', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const learningWord = em.create(Word, {
      lemma: `learning-${uuidv7().slice(0, 6)}`,
    });
    const learningDef = em.create(WordDefinition, {
      wordId: learningWord.id,
      pos: PartOfSpeech.Noun,
    });
    const skippedPhrase = em.create(Phrase, {
      phraseText: `skipped-${uuidv7().slice(0, 6)}`,
    });
    await em.flush();

    card(
      em,
      userId,
      { wordDefinitionId: learningDef.id },
      {
        state: LearningCardState.Learning,
        scheduledDays: 1,
      },
    );
    disposition(
      em,
      userId,
      { phraseId: skippedPhrase.id },
      Disposition.Skipped,
    );
    await em.flush();
    em.clear();

    const learningOnly = await suite.query(
      new GetDictionaryQuery(userId, {
        limit: 20,
        state: EffectiveState.Learning,
      }),
    );
    expect(learningOnly.items).toHaveLength(1);
    expect(learningOnly.items[0].primary).toBe(learningWord.lemma);

    const skippedOnly = await suite.query(
      new GetDictionaryQuery(userId, {
        limit: 20,
        state: EffectiveState.Skipped,
      }),
    );
    expect(skippedOnly.items).toHaveLength(1);
    expect(skippedOnly.items[0].primary).toBe(skippedPhrase.phraseText);
  });

  it('searches case-insensitively on lemma / phrase text only', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const word = em.create(Word, { lemma: `Harbour-${uuidv7().slice(0, 6)}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'a sheltered anchorage',
    });
    const phrase = em.create(Phrase, {
      phraseText: `set sail-${uuidv7().slice(0, 6)}`,
      definition: 'to depart by sea',
    });
    await em.flush();

    card(
      em,
      userId,
      { wordDefinitionId: definition.id },
      {
        state: LearningCardState.Learning,
        scheduledDays: 1,
      },
    );
    card(
      em,
      userId,
      { phraseId: phrase.id },
      {
        state: LearningCardState.Learning,
        scheduledDays: 1,
      },
    );
    await em.flush();
    em.clear();

    const bySubstring = await suite.query(
      new GetDictionaryQuery(userId, { limit: 20, search: 'HARBOUR' }),
    );
    expect(bySubstring.items).toHaveLength(1);
    expect(bySubstring.items[0].primary).toBe(word.lemma);

    const byDefinitionText = await suite.query(
      new GetDictionaryQuery(userId, { limit: 20, search: 'anchorage' }),
    );
    expect(byDefinitionText.items).toEqual([]);
  });

  it('paginates by lemma-group via cursor, alphabetically', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;
    const lemmas = ['alpha', 'bravo', 'charlie'].map(
      (prefix) => `${prefix}-${uuidv7().slice(0, 6)}`,
    );
    for (const lemma of lemmas) {
      const word = em.create(Word, { lemma });
      const definition = em.create(WordDefinition, {
        wordId: word.id,
        pos: PartOfSpeech.Noun,
      });
      card(
        em,
        userId,
        { wordDefinitionId: definition.id },
        {
          state: LearningCardState.Learning,
          scheduledDays: 1,
        },
      );
    }
    await em.flush();
    em.clear();

    const firstPage = await suite.query(
      new GetDictionaryQuery(userId, { limit: 2 }),
    );
    expect(firstPage.items.map((i) => i.primary).sort()).toEqual(
      [...lemmas].sort().slice(0, 2),
    );
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await suite.query(
      new GetDictionaryQuery(userId, {
        limit: 2,
        cursor: firstPage.nextCursor as string,
      }),
    );
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();

    const seen = [...firstPage.items, ...secondPage.items].map(
      (i) => i.primary,
    );
    expect(seen.sort()).toEqual([...lemmas].sort());
  });

  it('resolves each entry and lists the published posts the term appears in, de-duplicated', async () => {
    const em = suite.orm.em;
    const userId = (await seedUser(em)).id;

    const word = em.create(Word, { lemma: `tide-${uuidv7().slice(0, 6)}` });
    const definition = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'the rise and fall of the sea',
      cefrLevel: CefrLevel.B1,
    });
    await em.flush();
    card(
      em,
      userId,
      { wordDefinitionId: definition.id },
      {
        state: LearningCardState.Learning,
        scheduledDays: 1,
      },
    );

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
    em.clear();

    const view = await suite.query(
      new GetDictionaryQuery(userId, { limit: 20 }),
    );
    expect(view.items).toHaveLength(1);
    expect(view.items[0].posts.map((p) => p.shortId).sort()).toEqual(
      [older.shortId, newer.shortId].sort(),
    );
  });
});
