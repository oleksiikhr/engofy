import type { EntityManager } from '@mikro-orm/postgresql';
import { GrammarCategory } from '../../../post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import type { LearningCard } from '../../entities/learning-card.entity.js';
import type { PracticeCardTarget } from './practice-queue-item.js';

// Batched (no N+1) resolution of a set of cards' display targets — shared by
// every query that renders `LearningCard` rows as practice items
// (`get-practice-queue`, `get-due-post-cards`). `contextSentence` is always
// null here — only `GetPracticeQueueHandler` fills it in afterwards (PLAN.md
// practice-redesign зріз 1/3), since it needs the requesting user's read
// history, which this shared resolver doesn't have. Grammar targets also get
// their kicker/example/detail slug here (зріз 3): those come from the usage
// point's construction + category, not from the user's history.
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
      secondary: definition.definition ?? null,
      phonetic: definition.phonetic ?? null,
      contextSentence: null,
      kicker: null,
      exampleText: null,
      detailSlug: null,
    });
  }
  for (const phrase of phrases) {
    targets.set(`phrase:${phrase.id}`, {
      type: 'phrase',
      id: phrase.id,
      primary: phrase.phraseText,
      secondary: phrase.definition ?? null,
      phonetic: null,
      contextSentence: null,
      kicker: null,
      exampleText: null,
      detailSlug: null,
    });
  }
  const grammarLabels = await loadGrammarLabels(em, usagePoints);
  for (const point of usagePoints) {
    const { kicker, slug } = grammarLabels.get(point.constructionId) ?? {
      kicker: null,
      slug: null,
    };
    targets.set(`grammar:${point.id}`, {
      type: 'grammar',
      id: point.id,
      primary: point.guideword,
      secondary: point.canDoStatement,
      phonetic: null,
      contextSentence: null,
      kicker,
      exampleText: point.exampleText ?? null,
      detailSlug: slug,
    });
  }
  return targets;
}

interface GrammarLabel {
  kicker: string;
  slug: string;
}

// Per-construction "<category> · <construction>" kicker and detail-page slug
// for a set of usage points, in two batched lookups. A construction row that's
// missing leaves its usage points out of the map (callers fall back to null).
async function loadGrammarLabels(
  em: EntityManager,
  usagePoints: GrammarUsagePoint[],
): Promise<Map<string, GrammarLabel>> {
  const constructionIds = ids(usagePoints, (p) => p.constructionId);
  if (constructionIds.length === 0) {
    return new Map();
  }
  const constructions = await em.find(
    GrammarConstruction,
    { id: { $in: constructionIds } },
    { disableIdentityMap: true },
  );
  const categoryIds = ids(constructions, (c) => c.categoryId);
  const categories = categoryIds.length
    ? await em.find(
        GrammarCategory,
        { id: { $in: categoryIds } },
        { disableIdentityMap: true },
      )
    : [];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  return new Map(
    constructions.map((construction) => [
      construction.id,
      {
        kicker: [
          categoryNameById.get(construction.categoryId),
          construction.name,
        ]
          .filter(Boolean)
          .join(' · '),
        slug: construction.slug,
      },
    ]),
  );
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
