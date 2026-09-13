import type { EntityManager } from '@mikro-orm/postgresql';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import type { LearningCard } from '../../entities/learning-card.entity.js';
import type { PracticeCardTarget } from './practice-queue-item.js';

// Batched (no N+1) resolution of a set of cards' display targets — shared by
// every query that renders `LearningCard` rows as practice items
// (`get-practice-queue`, `get-due-post-cards`).
export async function resolveCardTargets(
  em: EntityManager,
  cards: LearningCard[],
): Promise<Map<string, PracticeCardTarget>> {
  const wordDefinitionIds = ids(cards, (c) => c.wordDefinitionId);
  const phraseIds = ids(cards, (c) => c.phraseId);
  const grammarIds = ids(cards, (c) => c.grammarUsagePointId);

  const [definitions, phrases, usagePoints] = await Promise.all([
    wordDefinitionIds.length
      ? em.find(
          WordDefinition,
          { id: { $in: wordDefinitionIds } },
          { disableIdentityMap: true },
        )
      : Promise.resolve([]),
    phraseIds.length
      ? em.find(
          Phrase,
          { id: { $in: phraseIds } },
          { disableIdentityMap: true },
        )
      : Promise.resolve([]),
    grammarIds.length
      ? em.find(
          GrammarUsagePoint,
          { id: { $in: grammarIds } },
          { disableIdentityMap: true },
        )
      : Promise.resolve([]),
  ]);
  const wordIds = ids(definitions, (d) => d.wordId);
  const words = wordIds.length
    ? await em.find(
        Word,
        { id: { $in: wordIds } },
        { disableIdentityMap: true },
      )
    : [];
  const wordById = new Map(words.map((word) => [word.id, word]));

  const targets = new Map<string, PracticeCardTarget>();
  for (const definition of definitions) {
    const word = wordById.get(definition.wordId);
    targets.set(`word:${definition.id}`, {
      type: 'word',
      id: definition.id,
      primary: word?.lemma ?? '',
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

export function cardTargetKey(card: LearningCard): string {
  if (card.wordDefinitionId) {
    return `word:${card.wordDefinitionId}`;
  }
  if (card.phraseId) {
    return `phrase:${card.phraseId}`;
  }
  return `grammar:${card.grammarUsagePointId}`;
}

function ids<T>(
  items: T[],
  pick: (item: T) => string | null | undefined,
): string[] {
  return [...new Set(items.map(pick).filter((id): id is string => !!id))];
}
