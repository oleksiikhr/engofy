import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { parseDoc } from '../../../post/domain/node-tree.parser.js';
import { assembleDocFromParts } from '../../../post/domain/post-parts.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { PostPart } from '../../../post/entities/post-part.entity.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
import { Sentence } from '../../../post/entities/sentence.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import {
  indexBlockSpans,
  type SpanOccurrence,
  sentenceContainsSpan,
} from '../../domain/context-sentence.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { GetPracticeQueueQuery } from './get-practice-queue.query.js';
import type {
  PracticeCardTarget,
  PracticeQueueItem,
} from './practice-queue-item.js';

// How many of the learner's most recent distinct read posts count as "context"
// for reveal content (PLAN.md practice-redesign зріз 1).
const RECENT_READ_POSTS_LIMIT = 3;

// The SRS review queue for a user (PLAN.md §4 `/practice`): every card whose
// `due` has arrived, soonest first, capped at `limit`. Fresh cards are due
// immediately, so they surface here too. Each card is resolved to its
// display text with batched lookups (no N+1).
@QueryHandler(GetPracticeQueueQuery)
export class GetPracticeQueueHandler
  implements IQueryHandler<GetPracticeQueueQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute(query: GetPracticeQueueQuery): Promise<PracticeQueueItem[]> {
    const cards = await this.em.find(
      LearningCard,
      {
        userId: query.userId,
        due: { $lte: DateTime.now() },
        archivedAt: null,
      },
      {
        orderBy: { due: 'asc', createdAt: 'asc' },
        limit: query.limit,
        disableIdentityMap: true,
      },
    );
    if (cards.length === 0) {
      return [];
    }

    const targets = await this.loadTargets(query.userId, cards);

    return cards
      .map((card) => {
        const target = targets.get(targetKey(card));
        if (!target) {
          return null;
        }
        return {
          cardId: card.id,
          state: card.state,
          due: card.due,
          target,
        } satisfies PracticeQueueItem;
      })
      .filter((item): item is PracticeQueueItem => item !== null);
  }

  private async loadTargets(
    userId: string,
    cards: LearningCard[],
  ): Promise<Map<string, PracticeCardTarget>> {
    const wordDefinitionIds = ids(cards, (c) => c.wordDefinitionId);
    const phraseIds = ids(cards, (c) => c.phraseId);
    const grammarIds = ids(cards, (c) => c.grammarUsagePointId);

    const [definitions, phrases, usagePoints] = await Promise.all([
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
      grammarIds.length
        ? this.em.find(
            GrammarUsagePoint,
            { id: { $in: grammarIds } },
            { disableIdentityMap: true },
          )
        : Promise.resolve([]),
    ]);
    const wordIds = ids(definitions, (d) => d.wordId);
    const words = wordIds.length
      ? await this.em.find(
          Word,
          { id: { $in: wordIds } },
          { disableIdentityMap: true },
        )
      : [];
    const wordById = new Map(words.map((word) => [word.id, word]));

    const contextKeys = [
      ...definitions.map((d) => `word:${d.id}`),
      ...phrases.map((p) => `phrase:${p.id}`),
    ];
    const contextSentenceByKey = await this.loadContextSentences(
      userId,
      contextKeys,
    );

    const targets = new Map<string, PracticeCardTarget>();
    for (const definition of definitions) {
      const word = wordById.get(definition.wordId);
      const key = `word:${definition.id}`;
      targets.set(key, {
        type: 'word',
        id: definition.id,
        primary: word?.lemma ?? '',
        secondary: definition.definition ?? null,
        phonetic: definition.phonetic ?? null,
        contextSentence: contextSentenceByKey.get(key) ?? null,
      });
    }
    for (const phrase of phrases) {
      const key = `phrase:${phrase.id}`;
      targets.set(key, {
        type: 'phrase',
        id: phrase.id,
        primary: phrase.phraseText,
        secondary: phrase.definition ?? null,
        phonetic: null,
        contextSentence: contextSentenceByKey.get(key) ?? null,
      });
    }
    for (const point of usagePoints) {
      targets.set(`grammar:${point.id}`, {
        type: 'grammar',
        id: point.id,
        primary: point.guideword,
        secondary: point.canDoStatement,
        phonetic: null,
        contextSentence: null,
      });
    }
    return targets;
  }

  // Batched, bounded search for a real sentence containing each wanted
  // word/phrase (PLAN.md practice-redesign зріз 1): scans the learner's last
  // `RECENT_READ_POSTS_LIMIT` distinct read posts, in recency order, for the
  // first occurrence of each key's span in the node tree, then resolves each
  // occurrence to its spaCy sentence in one final batched query. No fallback
  // to WordDefinition/Phrase.exampleSentence when nothing is found.
  private async loadContextSentences(
    userId: string,
    keys: string[],
  ): Promise<Map<string, string>> {
    if (keys.length === 0) {
      return new Map();
    }
    const wanted = new Set(keys);

    const reads = await this.em.find(
      PostRead,
      { userId },
      { orderBy: { readAt: 'desc' }, limit: RECENT_READ_POSTS_LIMIT },
    );
    if (reads.length === 0) {
      return new Map();
    }

    const occurrences = new Map<
      string,
      SpanOccurrence & { postPartId: string }
    >();
    for (const read of reads) {
      if (occurrences.size === wanted.size) {
        break;
      }
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — stops scanning further (older) reads as soon as every wanted key is found.
      const parts = await this.em.find(
        PostPart,
        { postId: read.postId },
        { orderBy: { blockIndex: 'asc' } },
      );
      if (parts.length === 0) {
        continue;
      }
      const doc = parseDoc(assembleDocFromParts(parts));
      parts.forEach((part, index) => {
        for (const [key, occurrence] of indexBlockSpans(doc.children[index])) {
          if (!wanted.has(key) || occurrences.has(key)) {
            continue;
          }
          occurrences.set(key, { postPartId: part.id, ...occurrence });
        }
      });
    }
    if (occurrences.size === 0) {
      return new Map();
    }

    const postPartIds = [
      ...new Set([...occurrences.values()].map((o) => o.postPartId)),
    ];
    const sentences = await this.em.find(Sentence, {
      postPartId: { $in: postPartIds },
    });

    const result = new Map<string, string>();
    for (const [key, occurrence] of occurrences) {
      const sentence = sentences.find(
        (s) =>
          s.postPartId === occurrence.postPartId &&
          s.unitIndex === occurrence.unitIndex &&
          sentenceContainsSpan(s, occurrence),
      );
      if (sentence) {
        result.set(key, sentence.rawText);
      }
    }
    return result;
  }
}

function ids<T>(
  items: T[],
  pick: (item: T) => string | null | undefined,
): string[] {
  return [...new Set(items.map(pick).filter((id): id is string => !!id))];
}

function targetKey(card: LearningCard): string {
  if (card.wordDefinitionId) {
    return `word:${card.wordDefinitionId}`;
  }
  if (card.phraseId) {
    return `phrase:${card.phraseId}`;
  }
  return `grammar:${card.grammarUsagePointId}`;
}
