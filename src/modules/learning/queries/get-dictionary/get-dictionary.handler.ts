import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Phrase } from '../../../post/entities/phrase.entity.js';
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
// excluded (they live on `/profile`). The "appears in" list is a bounded,
// indexed join from the deterministic sentence_tokens layer (word_id /
// phrase_id, set by the annotation stage) through sentences to posts — no
// full-post scan, no node-tree walk.
@QueryHandler(GetDictionaryQuery)
export class GetDictionaryHandler implements IQueryHandler<GetDictionaryQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: GetDictionaryQuery): Promise<DictionaryView> {
    const cards = await this.em.find(
      LearningCard,
      {
        userId,
        archivedAt: null,
        $or: [{ wordDefinitionId: { $ne: null } }, { phraseId: { $ne: null } }],
      },
      { orderBy: { due: 'asc', createdAt: 'asc' }, disableIdentityMap: true },
    );
    if (cards.length === 0) {
      return { items: [] };
    }

    const wordDefinitionIds = unique(
      cards.map((card) => card.wordDefinitionId),
    );
    const phraseIds = unique(cards.map((card) => card.phraseId));

    const [definitions, phrases] = await Promise.all([
      wordDefinitionIds.length
        ? this.em.find(
            WordDefinition,
            { id: { $in: wordDefinitionIds } },
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
    const wordIds = unique(definitions.map((definition) => definition.wordId));
    const words = wordIds.length
      ? await this.em.find(
          Word,
          { id: { $in: wordIds } },
          { disableIdentityMap: true },
        )
      : [];

    const wordById = new Map(words.map((word) => [word.id, word]));
    const definitionById = new Map(definitions.map((d) => [d.id, d]));
    const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));

    const usage = await this.buildUsageIndex(wordIds, phraseIds);

    const items: DictionaryEntryView[] = cards.map((card) => {
      if (card.wordDefinitionId) {
        const definition = definitionById.get(card.wordDefinitionId);
        const word = definition ? wordById.get(definition.wordId) : undefined;
        return this.wordEntry(
          card,
          word,
          definition,
          (definition && usage.byWord.get(definition.wordId)) ?? [],
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
      targetId: card.wordDefinitionId as string,
      state: card.state,
      due: card.due,
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
      due: card.due,
      primary: phrase?.phraseText ?? '',
      secondary: null,
      definition: phrase?.definition ?? null,
      example: phrase?.exampleSentence ?? null,
      cefrLevel: phrase?.cefrLevel ?? null,
      posts,
    };
  }

  // Published posts each card term appears in, newest first, keyed by the raw
  // card target id (word_id / phrase_id).
  private async buildUsageIndex(
    wordIds: string[],
    phraseIds: string[],
  ): Promise<UsageIndex> {
    const index = emptyUsageIndex();
    if (wordIds.length) {
      collectUsage(await this.queryUsage('word_id', wordIds), index.byWord);
    }
    if (phraseIds.length) {
      collectUsage(
        await this.queryUsage('phrase_id', phraseIds),
        index.byPhrase,
      );
    }
    return index;
  }

  // One indexed join per term kind: sentence_tokens (filtered on the linked
  // word_id / phrase_id) -> sentences (PK) -> posts (PK, published only), via
  // the denormalised sentences.post_id. DISTINCT collapses repeat mentions to
  // one row per (term, post); ORDER BY hands rows back newest-first so the
  // per-term lists come out sorted without a JS pass. DP5 raw SQL — `column`
  // is a fixed literal, every id is a bound param.
  private async queryUsage(
    column: 'word_id' | 'phrase_id',
    targetIds: string[],
  ): Promise<UsageRow[]> {
    const placeholders = targetIds.map(() => '?').join(', ');
    return this.em.getConnection().execute<UsageRow[]>(
      `SELECT DISTINCT st.${column} AS target_id, p.short_id, p.slug, p.title,
              p.published_at
         FROM sentence_tokens st
         JOIN sentences s ON s.id = st.sentence_id
         JOIN posts p ON p.id = s.post_id
        WHERE p.status = ?
          AND st.${column} IN (${placeholders})
        ORDER BY p.published_at DESC NULLS LAST`,
      [PostStatus.Published, ...targetIds],
      'all',
      this.em.getTransactionContext(),
    );
  }
}

interface UsageRow {
  target_id: string;
  short_id: string;
  slug: string | null;
  title: string | null;
  published_at: Date | null;
}

interface UsageIndex {
  byWord: Map<string, DictionaryPostRefView[]>;
  byPhrase: Map<string, DictionaryPostRefView[]>;
}

function emptyUsageIndex(): UsageIndex {
  return { byWord: new Map(), byPhrase: new Map() };
}

// Rows arrive newest-first (SQL ORDER BY), so appending in order keeps each
// per-term list newest-first.
function collectUsage(
  rows: UsageRow[],
  target: Map<string, DictionaryPostRefView[]>,
): void {
  for (const row of rows) {
    const list = target.get(row.target_id) ?? [];
    list.push({
      shortId: row.short_id,
      slug: row.slug ?? null,
      title: row.title ?? null,
    });
    target.set(row.target_id, list);
  }
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
