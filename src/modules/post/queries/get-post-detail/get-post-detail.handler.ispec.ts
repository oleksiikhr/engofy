import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { User } from '../../../auth/entities/user.entity.js';
import { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../../learning/entities/learning-disposition.entity.js';
import { Disposition } from '../../../learning/enums/disposition.enum.js';
import { LearningCardState } from '../../../learning/enums/learning-card-state.enum.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { ExerciseSource } from '../../enums/exercise-source.enum.js';
import { ExerciseType } from '../../enums/exercise-type.enum.js';
import { PartOfSpeech } from '../../enums/part-of-speech.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostSourceType } from '../../enums/post-source-type.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { GetPostDetailQuery } from './get-post-detail.query.js';

async function seedPublishedPost(em: EntityManager): Promise<{
  shortId: string;
  wordDefinitionId: string;
  wordId: string;
}> {
  const word = em.create(Word, { lemma: `travel-${uuidv7().slice(0, 8)}` });
  const definition = em.create(WordDefinition, {
    wordId: word.id,
    pos: PartOfSpeech.Verb,
    definition: 'to go from one place to another',
    cefrLevel: CefrLevel.A2,
  });

  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.type = PostSourceType.Original;
  source.rawText = 'She loves to travel widely.';
  source.attributionText = 'Original content';

  const post = new Post();
  post.source = source;
  post.title = 'A Short Trip';
  post.status = PostStatus.Published;
  em.persist(post);

  em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'She loves to ' },
        {
          type: 'span',
          kind: 'word',
          text: 'travel',
          wordDefinitionId: definition.id,
          pos: 'VERB',
        },
        { type: 'text', text: ' widely.' },
      ],
    },
  });

  em.create(Exercise, {
    postId: post.id,
    type: ExerciseType.FillBlank,
    source: ExerciseSource.Spacy,
    payload: {
      sentenceId: uuidv7(),
      prompt: 'She loves to ____.',
      answer: 'travel',
    },
  });

  await em.flush();
  return {
    shortId: post.shortId,
    wordDefinitionId: definition.id,
    wordId: word.id,
  };
}

async function seedUser(
  em: EntityManager,
  cefrLevel: CefrLevel = CefrLevel.A1,
): Promise<User> {
  const user = em.create(User, {
    email: `${uuidv7()}@example.com`,
    cefrLevel,
  });
  await em.flush();
  return user;
}

async function seedPostWithPhrases(
  em: EntityManager,
  phraseIds: string[],
): Promise<{ shortId: string }> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.type = PostSourceType.Original;
  source.rawText = 'phrases';
  source.attributionText = 'Original content';
  const post = new Post();
  post.source = source;
  post.title = 'Phrases';
  post.status = PostStatus.Published;
  em.persist(post);

  em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: phraseIds.map((phraseId) => ({
        type: 'span' as const,
        kind: 'phrase' as const,
        text: 'phrase',
        phraseId,
      })),
    },
  });
  await em.flush();
  return { shortId: post.shortId };
}

describe('GetPostDetailHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns null for an unknown short id', async () => {
    expect(await suite.query(new GetPostDetailQuery('Zzz00000'))).toBeNull();
  });

  it('does not expose a non-published post', async () => {
    const em = suite.orm.em;
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.type = PostSourceType.Original;
    source.rawText = 'x';
    source.attributionText = 'Original content';
    const post = new Post();
    post.source = source;
    post.title = 'Draft';
    post.status = PostStatus.Pending;
    em.persist(post);
    await em.flush();
    em.clear();

    expect(await suite.query(new GetPostDetailQuery(post.shortId))).toBeNull();
  });

  it('resolves annotations.grammar from a grammar_only span, usage points sorted by CEFR', async () => {
    const em = suite.orm.em;

    const category = em.create(GrammarCategory, { name: 'PAST', sortOrder: 0 });
    const construction = em.create(GrammarConstruction, {
      categoryId: category.id,
      name: 'past perfect',
      slug: 'past-perfect',
      sortOrder: 0,
    });
    // inserted B2 first, A2 second — the view must come back A2 first.
    em.create(GrammarUsagePoint, {
      constructionId: construction.id,
      egpIndex: 999,
      cefrLevel: CefrLevel.B2,
      guideword: 'later',
      canDoStatement: 'can do 999',
    });
    em.create(GrammarUsagePoint, {
      constructionId: construction.id,
      egpIndex: 412,
      cefrLevel: CefrLevel.A2,
      guideword: 'earlier',
      canDoStatement: 'can do 412',
    });

    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.type = PostSourceType.Original;
    source.rawText = 'She had left before noon.';
    source.attributionText = 'Original content';
    const post = new Post();
    post.source = source;
    post.title = 'Before Noon';
    post.status = PostStatus.Published;
    em.persist(post);

    em.create(PostPart, {
      postId: post.id,
      blockIndex: 0,
      kind: PostPartKind.Paragraph,
      body: {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'She ' },
          {
            type: 'span',
            kind: 'grammar_only',
            text: 'had left',
            grammarConstruct: 'past-perfect',
          },
          { type: 'text', text: ' before noon.' },
        ],
      },
    });
    await em.flush();

    const view = await suite.query(new GetPostDetailQuery(post.shortId));

    expect(view?.annotations.grammar['past-perfect']).toMatchObject({
      slug: 'past-perfect',
      name: 'past perfect',
      cefrLevel: CefrLevel.A2,
      usagePoints: [
        { cefrLevel: CefrLevel.A2, guideword: 'earlier' },
        { cefrLevel: CefrLevel.B2, guideword: 'later' },
      ],
    });
  });

  it('reassembles the doc and resolves the word annotation a span references', async () => {
    const { shortId, wordDefinitionId } = await seedPublishedPost(suite.orm.em);

    const view = await suite.query(new GetPostDetailQuery(shortId));

    expect(view?.doc.type).toBe('doc');
    expect(view?.annotations.words[wordDefinitionId]).toMatchObject({
      wordDefinitionId,
      pos: PartOfSpeech.Verb,
      definition: 'to go from one place to another',
      cefrLevel: CefrLevel.A2,
    });
    expect(view?.exercises).toHaveLength(1);
    expect(view?.exercises[0].type).toBe(ExerciseType.FillBlank);
  });

  it('gives every word and phrase state New for a guest (no userId)', async () => {
    const { shortId, wordDefinitionId } = await seedPublishedPost(suite.orm.em);

    const view = await suite.query(new GetPostDetailQuery(shortId));

    expect(view?.annotations.words[wordDefinitionId].state).toBe(
      EffectiveState.New,
    );
  });

  it("reflects the user's card as Learning for a word", async () => {
    const { shortId, wordDefinitionId } = await seedPublishedPost(suite.orm.em);
    const { id: userId } = await seedUser(suite.orm.em);
    suite.orm.em.create(LearningCard, {
      userId,
      wordDefinitionId,
      due: DateTime.now(),
      stability: 30,
      difficulty: 5,
      elapsedDays: 3,
      scheduledDays: 3,
      reps: 2,
      lapses: 0,
      state: LearningCardState.Review,
    });
    await suite.orm.em.flush();

    const view = await suite.query(new GetPostDetailQuery(shortId, userId));

    expect(view?.annotations.words[wordDefinitionId].state).toBe(
      EffectiveState.Learning,
    );
  });

  it('resolves a known disposition to Learned and a word at or below the user CEFR level to Learned', async () => {
    const em = suite.orm.em;
    const { shortId, wordDefinitionId } = await seedPublishedPost(em);
    const known = await seedUser(em, CefrLevel.A1);
    em.create(LearningDisposition, {
      userId: known.id,
      wordDefinitionId,
      disposition: Disposition.Known,
    });
    const advanced = await seedUser(em, CefrLevel.B2);
    await em.flush();

    const viewKnown = await suite.query(
      new GetPostDetailQuery(shortId, known.id),
    );
    const viewAdvanced = await suite.query(
      new GetPostDetailQuery(shortId, advanced.id),
    );

    expect(viewKnown?.annotations.words[wordDefinitionId].state).toBe(
      EffectiveState.Learned,
    );
    // The seeded sense is A2, at or below B2.
    expect(viewAdvanced?.annotations.words[wordDefinitionId].state).toBe(
      EffectiveState.Learned,
    );
  });

  it('resolves a phrase card to Learning and an untouched phrase to New', async () => {
    const em = suite.orm.em;
    const carded = em.create(Phrase, {
      phraseText: `at loose ends ${uuidv7().slice(0, 8)}`,
    });
    const untouched = em.create(Phrase, {
      phraseText: `hit the road ${uuidv7().slice(0, 8)}`,
    });
    const { shortId } = await seedPostWithPhrases(em, [
      carded.id,
      untouched.id,
    ]);
    const { id: userId } = await seedUser(em, CefrLevel.A1);
    em.create(LearningCard, {
      userId,
      phraseId: carded.id,
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

    const view = await suite.query(new GetPostDetailQuery(shortId, userId));

    expect(view?.annotations.phrases[carded.id].state).toBe(
      EffectiveState.Learning,
    );
    expect(view?.annotations.phrases[untouched.id].state).toBe(
      EffectiveState.New,
    );
  });

  // Regression: two POS senses of the same word must not share state — a card
  // on one sense used to leak onto every sense of the word because the
  // lookup matched by the shared `wordId`, not the per-sense
  // `wordDefinitionId` (learning-foundation §3).
  it('does not leak a card state onto a different sense of the same word', async () => {
    const em = suite.orm.em;
    const word = em.create(Word, { lemma: `bank-${uuidv7().slice(0, 8)}` });
    const nounSense = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'a financial institution',
    });
    const verbSense = em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Verb,
      definition: 'to tilt an aircraft',
    });

    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.type = PostSourceType.Original;
    source.rawText = 'The bank will bank sharply.';
    source.attributionText = 'Original content';
    const post = new Post();
    post.source = source;
    post.title = 'Two Senses';
    post.status = PostStatus.Published;
    em.persist(post);

    em.create(PostPart, {
      postId: post.id,
      blockIndex: 0,
      kind: PostPartKind.Paragraph,
      body: {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'The ' },
          {
            type: 'span',
            kind: 'word',
            text: 'bank',
            wordDefinitionId: nounSense.id,
            pos: 'NOUN',
          },
          { type: 'text', text: ' will ' },
          {
            type: 'span',
            kind: 'word',
            text: 'bank',
            wordDefinitionId: verbSense.id,
            pos: 'VERB',
          },
          { type: 'text', text: ' sharply.' },
        ],
      },
    });

    const { id: userId } = await seedUser(em, CefrLevel.A1);
    em.create(LearningCard, {
      userId,
      wordDefinitionId: nounSense.id,
      due: DateTime.now(),
      stability: 30,
      difficulty: 5,
      elapsedDays: 3,
      scheduledDays: 3,
      reps: 2,
      lapses: 0,
      state: LearningCardState.Review,
    });
    await em.flush();

    const view = await suite.query(
      new GetPostDetailQuery(post.shortId, userId),
    );

    expect(view?.annotations.words[nounSense.id].state).toBe(
      EffectiveState.Learning,
    );
    expect(view?.annotations.words[verbSense.id].state).toBe(
      EffectiveState.New,
    );
  });

  it('places grammar_matches as unit char ranges with the viewer state per usage point', async () => {
    const em = suite.orm.em;
    const { shortId, pointA, pointB } = await seedPostWithGrammarMatches(em);
    const { id: userId } = await seedUser(em, CefrLevel.A1);
    em.create(LearningCard, {
      userId,
      grammarUsagePointId: pointA,
      due: DateTime.now(),
      stability: 30,
      difficulty: 5,
      elapsedDays: 3,
      scheduledDays: 3,
      reps: 2,
      lapses: 0,
      state: LearningCardState.Review,
    });
    await em.flush();

    const view = await suite.query(new GetPostDetailQuery(shortId, userId));

    // The stale-sentence match on block 0 is dropped; block 1 is a list, so
    // the match carries its item index.
    expect(view?.annotations.grammarMatches).toEqual([
      {
        blockIndex: 1,
        itemIndex: 1,
        charStart: 4,
        charEnd: 12,
        grammarUsagePointId: pointA,
        state: EffectiveState.Learning,
      },
      {
        blockIndex: 1,
        itemIndex: 1,
        charStart: 13,
        charEnd: 24,
        grammarUsagePointId: pointB,
        state: EffectiveState.New,
      },
    ]);
  });

  it('resolves annotations.grammar for constructions reached only through a grammar match', async () => {
    const { shortId, pointA } = await seedPostWithGrammarMatches(suite.orm.em);

    const view = await suite.query(new GetPostDetailQuery(shortId));

    const entries = Object.values(view?.annotations.grammar ?? {});
    expect(entries).toHaveLength(1);
    expect(
      entries[0].usagePoints.map((point) => point.grammarUsagePointId),
    ).toContain(pointA);
  });

  it('gives every grammar match state New for a guest', async () => {
    const { shortId } = await seedPostWithGrammarMatches(suite.orm.em);

    const view = await suite.query(new GetPostDetailQuery(shortId));

    expect(
      view?.annotations.grammarMatches.map((match) => match.state),
    ).toEqual([EffectiveState.New, EffectiveState.New]);
  });

  it('returns no grammar matches for a post without sentences', async () => {
    const { shortId } = await seedPublishedPost(suite.orm.em);

    const view = await suite.query(new GetPostDetailQuery(shortId));

    expect(view?.annotations.grammarMatches).toEqual([]);
  });
});

// Block 0: paragraph "Intro text." with a sentence whose rawText is stale
// (match must be dropped). Block 1: a two-item list; item 1 is "She had left
// before noon." with two matches — "had left" (pointA) and "before noon."
// tokens 3..5 (pointB).
async function seedPostWithGrammarMatches(em: EntityManager): Promise<{
  shortId: string;
  pointA: string;
  pointB: string;
}> {
  const category = em.create(GrammarCategory, {
    name: `PAST-${uuidv7().slice(0, 8)}`,
    sortOrder: 0,
  });
  const construction = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'past perfect',
    slug: `past-perfect-${uuidv7().slice(0, 8)}`,
    sortOrder: 0,
  });
  const pointA = em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    egpIndex: Math.floor(Math.random() * 1_000_000),
    cefrLevel: CefrLevel.B2,
    guideword: 'a',
    canDoStatement: 'can do a',
  });
  const pointB = em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    egpIndex: Math.floor(Math.random() * 1_000_000) + 1_000_000,
    cefrLevel: CefrLevel.B2,
    guideword: 'b',
    canDoStatement: 'can do b',
  });

  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.type = PostSourceType.Original;
  source.rawText = 'Intro text.';
  source.attributionText = 'Original content';
  const post = new Post();
  post.source = source;
  post.title = 'Matches';
  post.status = PostStatus.Published;
  em.persist(post);

  const intro = em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [{ type: 'text', text: 'Intro text.' }],
    },
  });
  const list = em.create(PostPart, {
    postId: post.id,
    blockIndex: 1,
    kind: PostPartKind.List,
    body: {
      type: 'list',
      ordered: false,
      items: [
        { children: [{ type: 'text', text: 'First.' }] },
        {
          children: [
            { type: 'text', text: 'She ' },
            { type: 'span', kind: 'grammar_only', text: 'had left' },
            { type: 'text', text: ' before noon.' },
          ],
        },
      ],
    },
  });

  const stale = em.create(Sentence, {
    postId: post.id,
    postPartId: intro.id,
    unitIndex: 0,
    position: 0,
    rawText: 'Outdated.',
    charStart: 0,
    charEnd: 9,
  });
  const live = em.create(Sentence, {
    postId: post.id,
    postPartId: list.id,
    unitIndex: 1,
    position: 0,
    rawText: 'She had left before noon.',
    charStart: 0,
    charEnd: 25,
  });
  const tokenOffsets: [string, number, number][] = [
    ['She', 0, 3],
    ['had', 4, 7],
    ['left', 8, 12],
    ['before', 13, 19],
    ['noon', 20, 24],
    ['.', 24, 25],
  ];
  tokenOffsets.forEach(([text, charStart, charEnd], position) => {
    em.create(SentenceToken, {
      sentenceId: live.id,
      position,
      text,
      charStart,
      charEnd,
      lemma: text,
      pos: 'X',
      tag: 'X',
      dep: 'dep',
      morph: {},
    });
  });
  em.create(SentenceToken, {
    sentenceId: stale.id,
    position: 0,
    text: 'Outdated',
    charStart: 0,
    charEnd: 8,
    lemma: 'outdated',
    pos: 'X',
    tag: 'X',
    dep: 'dep',
    morph: {},
  });

  em.create(GrammarMatch, {
    sentenceId: live.id,
    grammarUsagePointId: pointA.id,
    tokenStart: 1,
    tokenEnd: 3,
  });
  em.create(GrammarMatch, {
    sentenceId: live.id,
    grammarUsagePointId: pointB.id,
    tokenStart: 3,
    tokenEnd: 5,
  });
  em.create(GrammarMatch, {
    sentenceId: stale.id,
    grammarUsagePointId: pointA.id,
    tokenStart: 0,
    tokenEnd: 1,
  });
  await em.flush();

  return { shortId: post.shortId, pointA: pointA.id, pointB: pointB.id };
}
