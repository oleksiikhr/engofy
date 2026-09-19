import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { parseDoc } from '../../../post/domain/node-tree.parser.js';
import { assembleDocFromParts } from '../../../post/domain/post-parts.js';
import { GrammarMatch } from '../../../post/entities/grammar-match.entity.js';
import { PostPart } from '../../../post/entities/post-part.entity.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
import { Sentence } from '../../../post/entities/sentence.entity.js';
import type { CardTargetType } from '../../domain/card-target.js';
import {
  indexBlockSpans,
  type SpanOccurrence,
  sentenceContainsSpan,
} from '../../domain/context-sentence.js';
import { capNewCards } from '../../domain/daily-new-card-limit.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { NewCardBudgetService } from '../../services/new-card-budget.service.js';
import { GetPracticeQueueQuery } from './get-practice-queue.query.js';
import type {
  PracticeCardTarget,
  PracticeQueueItem,
  PracticeQueueResult,
} from './practice-queue-item.js';
import { cardTargetKey, resolveCardTargets } from './resolve-card-targets.js';

function typeFilter(type: CardTargetType): FilterQuery<LearningCard> {
  switch (type) {
    case 'word':
      return { wordDefinitionId: { $ne: null } };
    case 'phrase':
      return { phraseId: { $ne: null } };
    case 'grammar':
      return { grammarUsagePointId: { $ne: null } };
  }
}

// How many of the learner's most recent distinct read posts count as "context"
// for reveal content (PLAN.md practice-redesign зріз 1).
const RECENT_READ_POSTS_LIMIT = 3;

// The SRS review queue for a user (PLAN.md §4 `/practice`): every card whose
// `due` has arrived, soonest first, capped at `limit`. Fresh cards are due
// immediately, so they surface here too. Within that batch, New cards are
// further throttled to whatever remains of `DAILY_NEW_CARD_LIMIT` for today
// (practice-redesign зріз 2) — due Review/Relearning cards are never capped —
// unless the caller passes `bypassNewLimit`. The remaining budget persists
// across repeated fetches on the same calendar day (derived from
// `review_logs`, not a stored counter — same "no counter" approach as
// `daily-streak.ts`), so grading down through today's backlog doesn't quietly
// let more New cards in once the visible batch shrinks below the cap. Each
// card is resolved to its display text with batched lookups (no N+1).
@QueryHandler(GetPracticeQueueQuery)
export class GetPracticeQueueHandler
  implements IQueryHandler<GetPracticeQueueQuery>
{
  constructor(
    private readonly em: EntityManager,
    private readonly newCardBudget: NewCardBudgetService,
  ) {}

  async execute(query: GetPracticeQueueQuery): Promise<PracticeQueueResult> {
    const cards = await this.findDueCards(query);
    if (cards.length === 0) {
      return {
        items: [],
        heldBackNewCount: 0,
        hasAnyCards: await this.userHasAnyCards(query.userId),
      };
    }

    let capped = cards;
    let heldBackCount = 0;
    if (
      !query.bypassNewLimit &&
      cards.some((card) => card.state === LearningCardState.New)
    ) {
      const remainingBudget = await this.newCardBudget.remaining(query.userId);
      ({ cards: capped, heldBackCount } = capNewCards(cards, remainingBudget));
    }

    const targets = await resolveCardTargets(this.em, capped);
    await this.attachContextSentences(query.userId, targets);

    const items = capped
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

    return {
      items,
      heldBackNewCount: heldBackCount,
      hasAnyCards:
        items.length > 0 || (await this.userHasAnyCards(query.userId)),
    };
  }

  // Due cards, in-progress ones (Learning/Review/Relearning) first and New
  // ones only in whatever slots remain, each group soonest-due first — so a
  // long backlog of fresh cards can never crowd out reviews that are already
  // scheduled.
  private async findDueCards(
    query: GetPracticeQueueQuery,
  ): Promise<LearningCard[]> {
    const base: FilterQuery<LearningCard> = {
      userId: query.userId,
      due: { $lte: DateTime.now() },
      archivedAt: null,
      ...(query.types && { $or: query.types.map(typeFilter) }),
    };
    const options = {
      orderBy: { due: 'asc', createdAt: 'asc' },
      disableIdentityMap: true,
    } as const;

    const inProgress = await this.em.find(
      LearningCard,
      { ...base, state: { $ne: LearningCardState.New } },
      { ...options, limit: query.limit },
    );
    if (inProgress.length >= query.limit) {
      return inProgress;
    }
    const fresh = await this.em.find(
      LearningCard,
      { ...base, state: LearningCardState.New },
      { ...options, limit: query.limit - inProgress.length },
    );
    return [...inProgress, ...fresh];
  }

  private async userHasAnyCards(userId: string): Promise<boolean> {
    const count = await this.em.count(LearningCard, {
      userId,
      archivedAt: null,
    });
    return count > 0;
  }

  // Fills in `contextSentence` (PLAN.md practice-redesign зріз 1/3) for the
  // targets `resolveCardTargets` left null — mutates `targets` in place since
  // each is a freshly-built object for this request only. Word/phrase go
  // through the node-tree bridge, grammar through `grammar_matches`; both are
  // bounded to the same last-N distinct read posts.
  private async attachContextSentences(
    userId: string,
    targets: Map<string, PracticeCardTarget>,
  ): Promise<void> {
    const spanKeys: string[] = [];
    const grammarKeys: string[] = [];
    for (const [key, target] of targets) {
      if (target.type === 'grammar') {
        grammarKeys.push(key);
      } else {
        spanKeys.push(key);
      }
    }
    if (spanKeys.length === 0 && grammarKeys.length === 0) {
      return;
    }

    const reads = await this.em.find(
      PostRead,
      { userId },
      { orderBy: { readAt: 'desc' }, limit: RECENT_READ_POSTS_LIMIT },
    );
    if (reads.length === 0) {
      return;
    }

    const [spanSentences, grammarSentences] = await Promise.all([
      this.loadContextSentences(reads, spanKeys),
      this.loadGrammarContextSentences(reads, grammarKeys),
    ]);
    for (const sentences of [spanSentences, grammarSentences]) {
      for (const [key, sentence] of sentences) {
        const target = targets.get(key);
        if (target) {
          target.contextSentence = sentence;
        }
      }
    }
  }

  // Batched, bounded search for a real sentence containing each wanted
  // word/phrase (PLAN.md practice-redesign зріз 1): scans the learner's last
  // `RECENT_READ_POSTS_LIMIT` distinct read posts, in recency order, for the
  // first occurrence of each key's span in the node tree, then resolves each
  // occurrence to its spaCy sentence in one final batched query. No fallback
  // to WordDefinition/Phrase.exampleSentence when nothing is found.
  private async loadContextSentences(
    reads: PostRead[],
    keys: string[],
  ): Promise<Map<string, string>> {
    if (keys.length === 0) {
      return new Map();
    }
    const wanted = new Set(keys);

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

  // Grammar counterpart of `loadContextSentences` (PLAN.md practice-redesign
  // зріз 3): `grammar_matches` already point at a `Sentence` directly, so no
  // node-tree/offset bridge is needed — just the matches of the wanted usage
  // points that fall in the recent read posts' sentences. Per usage point the
  // most recently read post wins, then the highest-confidence match. Keys are
  // `grammar:<usagePointId>`. No fallback to `exampleText`.
  private async loadGrammarContextSentences(
    reads: PostRead[],
    keys: string[],
  ): Promise<Map<string, string>> {
    if (keys.length === 0) {
      return new Map();
    }
    const usagePointIds = keys.map((key) => key.slice('grammar:'.length));
    const postIds = reads.map((read) => read.postId);

    const sentences = await this.em.find(Sentence, {
      postId: { $in: postIds },
    });
    if (sentences.length === 0) {
      return new Map();
    }
    const sentenceById = new Map(sentences.map((s) => [s.id, s]));
    const matches = await this.em.find(GrammarMatch, {
      grammarUsagePointId: { $in: usagePointIds },
      sentenceId: { $in: [...sentenceById.keys()] },
    });

    const recencyByPostId = new Map(postIds.map((id, i) => [id, i]));
    const best = new Map<
      string,
      { rank: number; confidence: number; text: string }
    >();
    for (const match of matches) {
      const sentence = sentenceById.get(match.sentenceId);
      if (!sentence) {
        continue;
      }
      const candidate = {
        rank: recencyByPostId.get(sentence.postId) ?? postIds.length,
        confidence: match.confidence ?? 0,
        text: sentence.rawText,
      };
      const current = best.get(match.grammarUsagePointId);
      if (
        !current ||
        candidate.rank < current.rank ||
        (candidate.rank === current.rank &&
          candidate.confidence > current.confidence)
      ) {
        best.set(match.grammarUsagePointId, candidate);
      }
    }

    const result = new Map<string, string>();
    for (const [usagePointId, { text }] of best) {
      result.set(`grammar:${usagePointId}`, text);
    }
    return result;
  }
}
