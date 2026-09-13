import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../../auth/entities/user.entity.js';
import {
  EffectiveState,
  resolveEffectiveState,
} from '../../../learning/domain/resolve-effective-state.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../../learning/entities/learning-disposition.entity.js';
import { CEFR_LEVELS, cefrRank } from '../../../post/domain/cefr-order.js';
import { GrammarMatch } from '../../../post/entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
import { Sentence } from '../../../post/entities/sentence.entity.js';
import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { NoPostAvailableError } from '../../errors/no-post-available.error.js';
import type { DailyPlanCandidate } from './daily-plan-candidate.js';
import { SelectDailyPlanCandidateQuery } from './select-daily-plan-candidate.query.js';

// Picks today's post + grammar highlight (daily-session-home plan, зріз 1,
// крок 0+1) — read-only; the caller (`CreateDailyPlanCommand`) does the
// actual write. Cross-module reads (auth `users`, learning `learning_cards`/
// `learning_dispositions`) are sanctioned from a query handler (A8).
@QueryHandler(SelectDailyPlanCandidateQuery)
export class SelectDailyPlanCandidateHandler
  implements IQueryHandler<SelectDailyPlanCandidateQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
  }: SelectDailyPlanCandidateQuery): Promise<DailyPlanCandidate> {
    const user = await this.em.findOneOrFail(
      User,
      { id: userId },
      { disableIdentityMap: true },
    );

    const post = await this.selectPost(userId, user.cefrLevel);
    const grammarUsagePointId = await this.selectGrammarHighlight(
      userId,
      post.id,
      user.cefrLevel,
    );

    return { postId: post.id, grammarUsagePointId };
  }

  // Newest unread post in CEFR±1 of the learner's level; widens to any level
  // (still unread) if that's empty, then to any published post at all (read
  // included) so a session always has something to show.
  private async selectPost(
    userId: string,
    userCefrLevel: CefrLevel,
  ): Promise<Post> {
    const readPostIds = (
      await this.em.find(PostRead, { userId }, { disableIdentityMap: true })
    ).map((read) => read.postId);

    const rank = cefrRank(userCefrLevel);
    const narrowLevels = CEFR_LEVELS.filter(
      (level) => Math.abs(cefrRank(level) - rank) <= 1,
    );

    const narrow = await this.findPost(narrowLevels, readPostIds);
    if (narrow) {
      return narrow;
    }

    const anyLevelUnread = await this.findPost(CEFR_LEVELS, readPostIds);
    if (anyLevelUnread) {
      return anyLevelUnread;
    }

    const anyPublished = await this.em.findOne(
      Post,
      { status: PostStatus.Published },
      {
        orderBy: { publishedAt: 'desc', id: 'desc' },
        disableIdentityMap: true,
      },
    );
    if (!anyPublished) {
      throw new NoPostAvailableError();
    }
    return anyPublished;
  }

  private findPost(
    levels: readonly CefrLevel[],
    excludePostIds: readonly string[],
  ): Promise<Post | null> {
    return this.em.findOne(
      Post,
      {
        status: PostStatus.Published,
        cefrLevel: { $in: [...levels] },
        ...(excludePostIds.length > 0
          ? { id: { $nin: [...excludePostIds] } }
          : {}),
      },
      {
        orderBy: { publishedAt: 'desc', id: 'desc' },
        disableIdentityMap: true,
      },
    );
  }

  // The first (by reading order) grammar usage point matched in the post
  // whose effective state (learning-foundation's 4-state model) is still
  // `New` — i.e. genuinely unlearned, not just card-free (a known/skipped
  // disposition or a below-level CEFR default both count as already learned
  // here). Null when nothing in the post qualifies.
  private async selectGrammarHighlight(
    userId: string,
    postId: string,
    userCefrLevel: CefrLevel,
  ): Promise<string | null> {
    const sentences = await this.em.find(
      Sentence,
      { postId },
      { disableIdentityMap: true },
    );
    if (sentences.length === 0) {
      return null;
    }

    const sentenceOrder = new Map(
      sentences.map((sentence) => [
        sentence.id,
        sentence.unitIndex * 1_000_000 + sentence.position,
      ]),
    );

    const matches = await this.em.find(
      GrammarMatch,
      { sentenceId: { $in: sentences.map((sentence) => sentence.id) } },
      { disableIdentityMap: true },
    );
    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => {
      const orderA = sentenceOrder.get(a.sentenceId) ?? 0;
      const orderB = sentenceOrder.get(b.sentenceId) ?? 0;
      return orderA - orderB || a.tokenStart - b.tokenStart;
    });
    const orderedUsagePointIds = unique(
      matches.map((match) => match.grammarUsagePointId),
    );

    const [usagePoints, cards, dispositions] = await Promise.all([
      this.em.find(
        GrammarUsagePoint,
        { id: { $in: orderedUsagePointIds } },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningCard,
        {
          userId,
          grammarUsagePointId: { $in: orderedUsagePointIds },
          archivedAt: null,
        },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningDisposition,
        { userId, grammarUsagePointId: { $in: orderedUsagePointIds } },
        { disableIdentityMap: true },
      ),
    ]);

    const usagePointById = new Map(
      usagePoints.map((point) => [point.id, point]),
    );
    const cardByUsagePointId = new Map(
      cards
        .filter((card) => card.grammarUsagePointId)
        .map((card) => [card.grammarUsagePointId as string, card]),
    );
    const dispositionByUsagePointId = new Map(
      dispositions
        .filter((disposition) => disposition.grammarUsagePointId)
        .map((disposition) => [
          disposition.grammarUsagePointId as string,
          disposition.disposition,
        ]),
    );

    for (const usagePointId of orderedUsagePointIds) {
      const point = usagePointById.get(usagePointId);
      if (!point) {
        continue;
      }
      const card = cardByUsagePointId.get(usagePointId);
      const state = resolveEffectiveState({
        card: card
          ? { state: card.state, scheduledDays: card.scheduledDays }
          : null,
        disposition: dispositionByUsagePointId.get(usagePointId) ?? null,
        targetCefrLevel: point.cefrLevel,
        userCefrLevel,
      });
      if (state === EffectiveState.New) {
        return usagePointId;
      }
    }
    return null;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
