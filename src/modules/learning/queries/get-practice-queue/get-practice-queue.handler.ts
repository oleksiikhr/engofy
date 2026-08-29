import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { GetPracticeQueueQuery } from './get-practice-queue.query.js';
import type {
  PracticeCardTarget,
  PracticeQueueItem,
} from './practice-queue-item.js';

// The SRS review queue for a user (PLAN.md §4 `/practice`): every card whose
// `due` has arrived, soonest first, capped at `limit`. Fresh cards are due
// immediately, so they surface here too. Each card is resolved to its
// display text with three batched lookups (no N+1).
@QueryHandler(GetPracticeQueueQuery)
export class GetPracticeQueueHandler
  implements IQueryHandler<GetPracticeQueueQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute(query: GetPracticeQueueQuery): Promise<PracticeQueueItem[]> {
    const cards = await this.em.find(
      LearningCard,
      { userId: query.userId, due: { $lte: DateTime.now() } },
      { orderBy: { due: 'asc', createdAt: 'asc' }, limit: query.limit },
    );
    if (cards.length === 0) {
      return [];
    }

    const targets = await this.loadTargets(cards);

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
    cards: LearningCard[],
  ): Promise<Map<string, PracticeCardTarget>> {
    const wordIds = ids(cards, (c) => c.wordId);
    const phraseIds = ids(cards, (c) => c.phraseId);
    const grammarIds = ids(cards, (c) => c.grammarUsagePointId);

    const [words, phrases, usagePoints] = await Promise.all([
      wordIds.length
        ? this.em.find(Word, { id: { $in: wordIds } })
        : Promise.resolve([]),
      phraseIds.length
        ? this.em.find(Phrase, { id: { $in: phraseIds } })
        : Promise.resolve([]),
      grammarIds.length
        ? this.em.find(GrammarUsagePoint, { id: { $in: grammarIds } })
        : Promise.resolve([]),
    ]);

    const targets = new Map<string, PracticeCardTarget>();
    for (const word of words) {
      targets.set(`word:${word.id}`, {
        type: 'word',
        id: word.id,
        primary: word.lemma,
        secondary: null,
      });
    }
    for (const phrase of phrases) {
      targets.set(`phrase:${phrase.id}`, {
        type: 'phrase',
        id: phrase.id,
        primary: phrase.phraseText,
        secondary: null,
      });
    }
    for (const point of usagePoints) {
      targets.set(`grammar:${point.id}`, {
        type: 'grammar',
        id: point.id,
        primary: point.guideword,
        secondary: point.canDoStatement,
      });
    }
    return targets;
  }
}

function ids(
  cards: LearningCard[],
  pick: (card: LearningCard) => string | null | undefined,
): string[] {
  return [...new Set(cards.map(pick).filter((id): id is string => !!id))];
}

function targetKey(card: LearningCard): string {
  if (card.wordId) {
    return `word:${card.wordId}`;
  }
  if (card.phraseId) {
    return `phrase:${card.phraseId}`;
  }
  return `grammar:${card.grammarUsagePointId}`;
}
