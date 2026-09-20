import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import {
  AI_CLIENT,
  type AiClient,
} from '../../../../core/ai/ai-client.port.js';
import { AiSchemaMismatchError } from '../../../../core/ai/ai-schema-mismatch.error.js';
import {
  buildGrammarEnrichmentUserText,
  GRAMMAR_ENRICHMENT_SYSTEM_PROMPT,
  type GrammarEnrichmentContent,
  grammarEnrichmentToolSchema,
  toGrammarEnrichmentContent,
} from '../../domain/grammar-enrichment-prompt.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { EnrichGrammarCommand } from './enrich-grammar.command.js';

export interface PostAiGrammarEnrichmentJobData {
  postId: string;
}

const ENRICHMENT_MAX_ATTEMPTS = 2;

// grammar_enrichment stage: fills `learnerExplanation` / `learnerExamples` on
// the grammar usage points this post matched. Runs off ai_grammar's completion
// (it needs the grammar_matches that stage writes) in parallel with
// ai_exercises; `publish` gates on it like it does on `enrichment`.
//
// Idempotency is row-level gap-fill (same stance as the lexicon enrichment):
// only points still `learnerExplanationUk IS NULL` are sent to the model, and an
// empty pending set completes the stage with zero AI calls — a point enriched
// by an earlier post is never re-billed.
@CommandHandler(EnrichGrammarCommand)
export class EnrichGrammarHandler
  implements ICommandHandler<EnrichGrammarCommand>
{
  private readonly logger = new Logger(EnrichGrammarHandler.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
  ) {}

  async execute(command: EnrichGrammarCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.GrammarEnrichment,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    await this.em.findOneOrFail(Post, postId);

    const pending = await this.loadPending(postId);
    if (pending.length === 0) {
      this.logger.log({ postId }, 'grammar_enrichment: nothing pending');
    } else {
      const contents = await this.enrich(pending);
      let filled = 0;
      pending.forEach(({ point }, i) => {
        const content = contents[i];
        if (content) {
          point.learnerExplanation = content.explanation;
          point.learnerExplanationUk = content.explanationUk;
          point.learnerExamples = content.examples;
          filled += 1;
        }
      });
      this.logger.log(
        { postId, pending: pending.length, filled },
        'grammar_enrichment filled usage points',
      );
    }

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.GrammarEnrichment;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);
  }

  private async loadPending(postId: string): Promise<PendingPoint[]> {
    const sentences = await this.em.find(
      Sentence,
      { postId },
      { fields: ['id'] },
    );
    if (sentences.length === 0) {
      return [];
    }

    const matches = await this.em.find(GrammarMatch, {
      sentenceId: { $in: sentences.map((sentence) => sentence.id) },
    });
    const pointIds = [
      ...new Set(matches.map((match) => match.grammarUsagePointId)),
    ];
    if (pointIds.length === 0) {
      return [];
    }

    const points = await this.em.find(
      GrammarUsagePoint,
      { id: { $in: pointIds }, learnerExplanationUk: null },
      { orderBy: { egpIndex: 'asc' } },
    );
    if (points.length === 0) {
      return [];
    }

    const constructions = await this.em.find(GrammarConstruction, {
      id: { $in: [...new Set(points.map((point) => point.constructionId))] },
    });
    const categories = await this.em.find(GrammarCategory, {
      id: { $in: [...new Set(constructions.map((c) => c.categoryId))] },
    });
    const constructionById = new Map(constructions.map((c) => [c.id, c]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    return points.flatMap((point) => {
      const construction = constructionById.get(point.constructionId);
      if (!construction) {
        return [];
      }
      return [
        {
          point,
          userText: buildGrammarEnrichmentUserText({
            constructionName: construction.name,
            categoryName: categoryById.get(construction.categoryId)?.name ?? '',
            cefrLevel: point.cefrLevel,
            guideword: point.guideword,
            canDoStatement: point.canDoStatement,
            cheatSheetContent: construction.cheatSheetContent ?? null,
          }),
        },
      ];
    });
  }

  private async enrich(
    pending: PendingPoint[],
  ): Promise<(GrammarEnrichmentContent | null)[]> {
    return await Promise.all(
      pending.map(({ point, userText }) =>
        this.enrichPoint(point.id, userText),
      ),
    );
  }

  // One usage point's model call, retried on a malformed payload. A point that
  // still fails is skipped (left un-enriched): its bad payload must not fail
  // the stage for every other point, and a later post gap-fills it.
  private async enrichPoint(
    grammarUsagePointId: string,
    userText: string,
  ): Promise<GrammarEnrichmentContent | null> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: each attempt only runs after the previous one failed.
        const result = await this.ai.completeStructured({
          system: GRAMMAR_ENRICHMENT_SYSTEM_PROMPT,
          userText,
          tool: {
            name: 'report_grammar_enrichment',
            description:
              'Report the learner explanation and example sentences for the grammar usage point.',
            schema: grammarEnrichmentToolSchema,
          },
        });
        return toGrammarEnrichmentContent(result);
      } catch (err) {
        if (!(err instanceof AiSchemaMismatchError)) {
          throw err;
        }
        if (attempt >= ENRICHMENT_MAX_ATTEMPTS) {
          this.logger.warn(
            { err, grammarUsagePointId, attempts: attempt },
            'grammar_enrichment skipped: model payload failed schema validation',
          );
          return null;
        }
      }
    }
  }
}

interface PendingPoint {
  point: GrammarUsagePoint;
  userText: string;
}
