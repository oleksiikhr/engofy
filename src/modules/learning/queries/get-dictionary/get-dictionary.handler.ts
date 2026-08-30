import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { cefrRank } from '../../../post/domain/cefr-order.js';
import { collectSpanNodes } from '../../../post/domain/collect-spans.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostPart } from '../../../post/entities/post-part.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import type {
  DictionaryEntryView,
  DictionaryPostRefView,
  DictionaryView,
} from './dictionary-view.js';
import { GetDictionaryQuery } from './get-dictionary.query.js';

// Backs `/dictionary` (PLAN.md §4): the learner's word and phrase SRS cards
// with status and the published posts each term appears in. Grammar cards are
// excluded (they live on `/profile`). The "appears in" list is derived from
// the node-tree spans of published posts — an interim stand-in for a
// post_word / post_phrase projection table (PLAN.md §3.3).
@QueryHandler(GetDictionaryQuery)
export class GetDictionaryHandler implements IQueryHandler<GetDictionaryQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: GetDictionaryQuery): Promise<DictionaryView> {
    const cards = await this.em.find(
      LearningCard,
      { userId, $or: [{ wordId: { $ne: null } }, { phraseId: { $ne: null } }] },
      { orderBy: { due: 'asc', createdAt: 'asc' }, disableIdentityMap: true },
    );
    if (cards.length === 0) {
      return { items: [] };
    }

    const wordIds = unique(cards.map((card) => card.wordId));
    const phraseIds = unique(cards.map((card) => card.phraseId));

    const [definitions, phrases] = await Promise.all([
      wordIds.length
        ? this.em.find(
            WordDefinition,
            { wordId: { $in: wordIds } },
            { disableIdentityMap: true },
          )
        : Promise.resolve([]),
      phraseIds.length
        ? this.em.find(
            Phrase,
            { id: { $in: phraseIds } },
            { disableIdentityMap: true },
          )
        : Promise.resolve([]),
    ]);
    const words = wordIds.length
      ? await this.em.find(
          Word,
          { id: { $in: wordIds } },
          { disableIdentityMap: true },
        )
      : [];

    const wordById = new Map(words.map((word) => [word.id, word]));
    const bestDefByWord = pickBestDefinitions(definitions);
    const defIdsByWord = groupIds(
      definitions,
      (d) => d.wordId,
      (d) => d.id,
    );
    const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));

    const usage = await this.buildUsageIndex(
      new Set(definitions.map((d) => d.id)),
      new Set(phraseIds),
    );

    const items: DictionaryEntryView[] = cards.map((card) => {
      if (card.wordId) {
        return this.wordEntry(
          card,
          wordById.get(card.wordId),
          bestDefByWord.get(card.wordId),
          mergePosts(defIdsByWord.get(card.wordId) ?? [], usage.byWordDef),
        );
      }
      const phraseId = card.phraseId as string;
      return this.phraseEntry(
        card,
        phraseById.get(phraseId),
        usage.byPhrase.get(phraseId) ?? [],
      );
    });

    return { items };
  }

  private wordEntry(
    card: LearningCard,
    word: Word | undefined,
    definition: WordDefinition | undefined,
    posts: DictionaryPostRefView[],
  ): DictionaryEntryView {
    return {
      cardId: card.id,
      type: 'word',
      targetId: card.wordId as string,
      state: card.state,
      due: card.due.toISO() ?? card.due.toString(),
      primary: word?.lemma ?? '',
      secondary: definition?.pos ?? null,
      definition: definition?.definition ?? null,
      example: definition?.exampleSentence ?? null,
      cefrLevel: definition?.cefrLevel ?? null,
      posts,
    };
  }

  private phraseEntry(
    card: LearningCard,
    phrase: Phrase | undefined,
    posts: DictionaryPostRefView[],
  ): DictionaryEntryView {
    return {
      cardId: card.id,
      type: 'phrase',
      targetId: card.phraseId as string,
      state: card.state,
      due: card.due.toISO() ?? card.due.toString(),
      primary: phrase?.phraseText ?? '',
      secondary: null,
      definition: phrase?.definition ?? null,
      example: phrase?.exampleSentence ?? null,
      cefrLevel: phrase?.cefrLevel ?? null,
      posts,
    };
  }

  // One pass over every published post's parts, keeping only the refs for the
  // word-definition / phrase ids this dictionary actually needs.
  private async buildUsageIndex(
    wantedDefIds: Set<string>,
    wantedPhraseIds: Set<string>,
  ): Promise<UsageIndex> {
    if (wantedDefIds.size === 0 && wantedPhraseIds.size === 0) {
      return emptyUsageIndex();
    }

    const posts = await this.em.find(
      Post,
      { status: PostStatus.Published },
      { orderBy: { publishedAt: 'desc' }, disableIdentityMap: true },
    );
    if (posts.length === 0) {
      return emptyUsageIndex();
    }

    const postById = new Map(posts.map((post) => [post.id, post]));
    const parts = await this.em.find(
      PostPart,
      { postId: { $in: posts.map((post) => post.id) } },
      { disableIdentityMap: true },
    );

    return indexSpanUsage(parts, postById, wantedDefIds, wantedPhraseIds);
  }
}

interface UsageIndex {
  byWordDef: Map<string, DictionaryPostRefView[]>;
  byPhrase: Map<string, DictionaryPostRefView[]>;
}

function emptyUsageIndex(): UsageIndex {
  return { byWordDef: new Map(), byPhrase: new Map() };
}

function indexSpanUsage(
  parts: PostPart[],
  postById: Map<string, Post>,
  wantedDefIds: Set<string>,
  wantedPhraseIds: Set<string>,
): UsageIndex {
  const index = emptyUsageIndex();
  const seen = new Set<string>();
  for (const part of parts) {
    const post = postById.get(part.postId);
    if (!post) {
      continue;
    }
    for (const span of collectSpanNodes([part.body])) {
      if (span.kind === 'word' && wantedDefIds.has(span.wordDefinitionId)) {
        pushRef(index.byWordDef, span.wordDefinitionId, post, seen);
      } else if (span.kind === 'phrase' && wantedPhraseIds.has(span.phraseId)) {
        pushRef(index.byPhrase, span.phraseId, post, seen);
      }
    }
  }
  return index;
}

function pushRef(
  index: Map<string, DictionaryPostRefView[]>,
  key: string,
  post: Post,
  seen: Set<string>,
): void {
  const dedupeKey = `${key}:${post.id}`;
  if (seen.has(dedupeKey)) {
    return;
  }
  seen.add(dedupeKey);
  const list = index.get(key) ?? [];
  list.push({
    shortId: post.shortId,
    slug: post.slug ?? null,
    title: post.title ?? null,
  });
  index.set(key, list);
}

function mergePosts(
  defIds: string[],
  byWordDef: Map<string, DictionaryPostRefView[]>,
): DictionaryPostRefView[] {
  const byShortId = new Map<string, DictionaryPostRefView>();
  for (const defId of defIds) {
    for (const ref of byWordDef.get(defId) ?? []) {
      byShortId.set(ref.shortId, ref);
    }
  }
  return [...byShortId.values()];
}

function pickBestDefinitions(
  definitions: WordDefinition[],
): Map<string, WordDefinition> {
  const best = new Map<string, WordDefinition>();
  for (const definition of definitions) {
    const current = best.get(definition.wordId);
    if (!current || scoreDefinition(definition) > scoreDefinition(current)) {
      best.set(definition.wordId, definition);
    }
  }
  return best;
}

// Prefer a definition that has actual text, then the easiest CEFR level.
function scoreDefinition(definition: WordDefinition): number {
  const hasText = definition.definition ? 100 : 0;
  const level = definition.cefrLevel ? 6 - cefrRank(definition.cefrLevel) : 0;
  return hasText + level;
}

function groupIds<T>(
  items: T[],
  keyOf: (item: T) => string,
  idOf: (item: T) => string,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const list = groups.get(keyOf(item)) ?? [];
    list.push(idOf(item));
    groups.set(keyOf(item), list);
  }
  return groups;
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
