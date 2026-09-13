import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import type { PracticeQueueItem } from '../get-practice-queue/practice-queue-item.js';
import {
  cardTargetKey,
  resolveCardTargets,
} from '../get-practice-queue/resolve-card-targets.js';
import { GetDuePostCardsQuery } from './get-due-post-cards.query.js';

// How many never-reviewed cards Крок 2 of the daily session introduces from
// one post — reviews of already-known material aren't capped, only the New
// ones (daily-session-home PLAN, зріз 2). `practice-redesign` reuses this
// same constant instead of defining its own.
export const DAILY_NEW_CARD_LIMIT = 12;

interface WordAndPhraseIdsRow {
  word_id: string | null;
  phrase_id: string | null;
}

interface GrammarMatchRow {
  grammar_usage_point_id: string;
}

// "Due cards whose target occurs in this post" — entry-point-agnostic
// (`postId` + `userId` only) so `daily-session-home` and, later,
// `post-detail-redesign`'s reader final screen can both call it (see the
// query's own doc comment). Computed live on every call, never cached
// (PLAN.md source `prompt.txt`). The word/phrase/grammar membership check
// joins the deterministic spaCy layer (`sentence_tokens` / `grammar_matches`
// -> `sentences.postId`), the same bounded/indexed pattern as
// `get-dictionary`'s reverse "appears in" join (DP5).
@QueryHandler(GetDuePostCardsQuery)
export class GetDuePostCardsHandler
  implements IQueryHandler<GetDuePostCardsQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    postId,
    userId,
  }: GetDuePostCardsQuery): Promise<PracticeQueueItem[]> {
    const [{ wordIds, phraseIds }, grammarUsagePointIds] = await Promise.all([
      this.loadPostWordAndPhraseIds(postId),
      this.loadPostGrammarUsagePointIds(postId),
    ]);
    if (
      wordIds.length === 0 &&
      phraseIds.length === 0 &&
      grammarUsagePointIds.length === 0
    ) {
      return [];
    }

    const dueCards = await this.em.find(
      LearningCard,
      { userId, due: { $lte: DateTime.now() }, archivedAt: null },
      { orderBy: { due: 'asc', createdAt: 'asc' }, disableIdentityMap: true },
    );
    if (dueCards.length === 0) {
      return [];
    }

    const wordIdByDefinitionId = await this.loadWordIdByDefinitionId(dueCards);
    const wordIdSet = new Set(wordIds);
    const phraseIdSet = new Set(phraseIds);
    const grammarIdSet = new Set(grammarUsagePointIds);

    const postCards = dueCards.filter((card) => {
      if (card.wordDefinitionId) {
        const wordId = wordIdByDefinitionId.get(card.wordDefinitionId);
        return !!wordId && wordIdSet.has(wordId);
      }
      if (card.phraseId) {
        return phraseIdSet.has(card.phraseId);
      }
      return (
        !!card.grammarUsagePointId && grammarIdSet.has(card.grammarUsagePointId)
      );
    });
    if (postCards.length === 0) {
      return [];
    }

    const capped = capNewCards(postCards);
    const targets = await resolveCardTargets(this.em, capped);

    return capped
      .map((card) => {
        const target = targets.get(cardTargetKey(card));
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

  private async loadWordIdByDefinitionId(
    cards: LearningCard[],
  ): Promise<Map<string, string>> {
    const wordDefinitionIds = [
      ...new Set(
        cards
          .map((card) => card.wordDefinitionId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (wordDefinitionIds.length === 0) {
      return new Map();
    }
    const definitions = await this.em.find(
      WordDefinition,
      { id: { $in: wordDefinitionIds } },
      { disableIdentityMap: true },
    );
    return new Map(definitions.map((d) => [d.id, d.wordId]));
  }

  // Distinct word/phrase ids the post's spaCy tokens link, via the
  // denormalised `sentences.post_id` — bounded to one post, no full-token
  // load (the `get-dictionary` lesson, db-performance.md "unbounded reads").
  private async loadPostWordAndPhraseIds(
    postId: string,
  ): Promise<{ wordIds: string[]; phraseIds: string[] }> {
    const rows = await this.em.getConnection().execute<WordAndPhraseIdsRow[]>(
      `SELECT DISTINCT st.word_id, st.phrase_id
         FROM sentence_tokens st
         JOIN sentences s ON s.id = st.sentence_id
        WHERE s.post_id = ?
          AND (st.word_id IS NOT NULL OR st.phrase_id IS NOT NULL)`,
      [postId],
      'all',
      this.em.getTransactionContext(),
    );
    const wordIds = new Set<string>();
    const phraseIds = new Set<string>();
    for (const row of rows) {
      if (row.word_id) {
        wordIds.add(row.word_id);
      }
      if (row.phrase_id) {
        phraseIds.add(row.phrase_id);
      }
    }
    return { wordIds: [...wordIds], phraseIds: [...phraseIds] };
  }

  private async loadPostGrammarUsagePointIds(
    postId: string,
  ): Promise<string[]> {
    const rows = await this.em.getConnection().execute<GrammarMatchRow[]>(
      `SELECT DISTINCT gm.grammar_usage_point_id
         FROM grammar_matches gm
         JOIN sentences s ON s.id = gm.sentence_id
        WHERE s.post_id = ?`,
      [postId],
      'all',
      this.em.getTransactionContext(),
    );
    return [...new Set(rows.map((row) => row.grammar_usage_point_id))];
  }
}

// Keeps every review/relearning card (already-known material isn't capped)
// but stops adding New ones past `DAILY_NEW_CARD_LIMIT`.
function capNewCards(cards: LearningCard[]): LearningCard[] {
  let newCount = 0;
  const result: LearningCard[] = [];
  for (const card of cards) {
    if (card.state === LearningCardState.New) {
      if (newCount >= DAILY_NEW_CARD_LIMIT) {
        continue;
      }
      newCount += 1;
    }
    result.push(card);
  }
  return result;
}
