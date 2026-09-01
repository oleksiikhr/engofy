import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
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
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetDictionaryQuery } from './get-dictionary.query.js';

function card(
  em: EntityManager,
  userId: string,
  target: Partial<
    Pick<LearningCard, 'wordId' | 'phraseId' | 'grammarUsagePointId'>
  >,
): void {
  em.create(LearningCard, {
    userId,
    wordId: target.wordId ?? null,
    phraseId: target.phraseId ?? null,
    grammarUsagePointId: target.grammarUsagePointId ?? null,
    due: DateTime.now(),
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: LearningCardState.New,
  });
}

// A published (or draft) post whose spaCy layer links one token to the given
// word/phrase — the shape GetDictionaryHandler now joins on. `mentions`
// controls how many linked tokens the post carries (to exercise the
// per-(term, post) de-duplication).
function postLinking(
  em: EntityManager,
  opts: {
    status: PostStatus;
    wordId?: string;
    phraseId?: string;
    publishedAt?: DateTime;
    mentions?: number;
  },
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
  if (opts.publishedAt) {
    post.publishedAt = opts.publishedAt;
  }
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

  const mentions = opts.mentions ?? 1;
  for (let i = 0; i < mentions; i += 1) {
    em.create(SentenceToken, {
      sentenceId: sentence.id,
      position: i,
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
  return post;
}

describe('GetDictionaryHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns no items when the learner has no word/phrase cards', async () => {
    const view = await suite.query(new GetDictionaryQuery(uuidv7()));
    expect(view.items).toEqual([]);
  });

  it('resolves each card and lists the published posts the term appears in, de-duplicated', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const word = em.create(Word, { lemma: `harbour-${uuidv7().slice(0, 6)}` });
    em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'a place where ships shelter',
      cefrLevel: CefrLevel.B1,
    });
    const phrase = em.create(Phrase, { phraseText: 'set sail' });
    await em.flush();

    card(em, userId, { wordId: word.id });
    card(em, userId, { phraseId: phrase.id });
    card(em, userId, { grammarUsagePointId: uuidv7() }); // excluded — grammar

    // Two published posts mention the word (one twice — must collapse to a
    // single ref); a draft mention must not surface.
    const pubA = postLinking(em, {
      status: PostStatus.Published,
      wordId: word.id,
      mentions: 2,
    });
    const pubB = postLinking(em, {
      status: PostStatus.Published,
      wordId: word.id,
    });
    postLinking(em, { status: PostStatus.Pending, wordId: word.id }); // draft
    const pubPhrase = postLinking(em, {
      status: PostStatus.Published,
      phraseId: phrase.id,
    });
    await em.flush();
    em.clear();

    const view = await suite.query(new GetDictionaryQuery(userId));

    expect(view.items).toHaveLength(2);
    const wordEntry = view.items.find((i) => i.type === 'word');
    expect(wordEntry).toMatchObject({
      primary: word.lemma,
      secondary: PartOfSpeech.Noun,
      definition: 'a place where ships shelter',
      cefrLevel: CefrLevel.B1,
    });
    expect(wordEntry?.posts).toHaveLength(2); // two published, draft excluded
    expect(wordEntry?.posts.map((p) => p.shortId).sort()).toEqual(
      [pubA.shortId, pubB.shortId].sort(),
    );

    const phraseEntry = view.items.find((i) => i.type === 'phrase');
    expect(phraseEntry?.primary).toBe('set sail');
    expect(phraseEntry?.posts.map((p) => p.shortId)).toEqual([
      pubPhrase.shortId,
    ]);
  });

  it('orders the "appears in" posts newest-published first', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const word = em.create(Word, { lemma: `tide-${uuidv7().slice(0, 6)}` });
    await em.flush();
    card(em, userId, { wordId: word.id });

    const older = postLinking(em, {
      status: PostStatus.Published,
      wordId: word.id,
      publishedAt: DateTime.now().minus({ days: 10 }),
    });
    const newer = postLinking(em, {
      status: PostStatus.Published,
      wordId: word.id,
      publishedAt: DateTime.now().minus({ days: 1 }),
    });
    await em.flush();
    em.clear();

    const view = await suite.query(new GetDictionaryQuery(userId));

    const wordEntry = view.items.find((i) => i.type === 'word');
    expect(wordEntry?.posts.map((p) => p.shortId)).toEqual([
      newer.shortId,
      older.shortId,
    ]);
  });
});
