import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import {
  AI_CLIENT,
  type AiClient,
} from '../../../../core/ai/ai-client.port.js';
import { AiSchemaMismatchError } from '../../../../core/ai/ai-schema-mismatch.error.js';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import {
  buildExercises,
  type ExerciseSentenceInput,
} from '../../domain/build-exercises.js';
import {
  buildGrammarContrastiveUserText,
  GRAMMAR_CONTRASTIVE_SYSTEM_PROMPT,
  type GrammarContrastiveResult,
  grammarContrastiveToolSchema,
  markSentenceSpan,
} from '../../domain/grammar-contrastive-prompt.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { ExerciseSource } from '../../enums/exercise-source.enum.js';
import { ExerciseType } from '../../enums/exercise-type.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import type { PostPublishJobData } from '../publish-post/publish-post.handler.js';
import { GenerateExercisesCommand } from './generate-exercises.command.js';

// Model calls per usage point before a malformed payload is skipped.
const CONTRASTIVE_MAX_ATTEMPTS = 3;

export interface PostAiExercisesJobData {
  postId: string;
}

// ai_exercises stage (PLAN.md §5, §3.10): most exercises are built
// deterministically from `sentence_tokens` (build-exercises.ts, no AI);
// grammar_contrastive exercises come from one structured AI call per grammar
// usage point matched in the post (the stage runs per post, not per viewer, so
// every matched usage point gets one — the reader filters by the viewer's
// state). Consumes the
// spaCy `sentences` / `sentence_tokens` from spacy_parse; in the DAG it is
// the stage after ai_grammar (TagGrammarHandler enqueues it on completion).
// Idempotent via the stage-level PostPipelineRun row (§12); a partial re-run
// rebuilds every exercise for the post.
@CommandHandler(GenerateExercisesCommand)
export class GenerateExercisesHandler
  implements ICommandHandler<GenerateExercisesCommand>
{
  private readonly logger = new Logger(GenerateExercisesHandler.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: GenerateExercisesCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiExercises,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    await this.em.findOneOrFail(Post, postId);

    const sentences = await this.em.find(
      Sentence,
      { postId },
      { orderBy: { postPartId: 'asc', unitIndex: 'asc', position: 'asc' } },
    );
    if (sentences.length === 0) {
      throw new Error(
        `ai_exercises needs spacy_parse output — no sentences for post ${postId}`,
      );
    }

    const tokensBySentence = await this.loadTokens(sentences.map((s) => s.id));
    const inputs: ExerciseSentenceInput[] = sentences.map((sentence) => ({
      id: sentence.id,
      rawText: sentence.rawText,
      tokens: (tokensBySentence.get(sentence.id) ?? []).map((token) => ({
        position: token.position,
        text: token.text,
        charStart: token.charStart,
        charEnd: token.charEnd,
        lemma: token.lemma,
        pos: token.pos,
        tag: token.tag,
      })),
    }));

    const drafts = buildExercises(inputs);
    const contrastive = await this.buildContrastive(
      sentences,
      tokensBySentence,
    );

    await this.em.nativeDelete(Exercise, { postId });

    for (const draft of drafts) {
      const exercise = new Exercise();
      exercise.postId = postId;
      exercise.type = draft.type;
      exercise.source = draft.source;
      exercise.payload = { ...draft.payload };
      this.em.persist(exercise);
    }

    for (const item of contrastive) {
      const exercise = new Exercise();
      exercise.postId = postId;
      exercise.type = ExerciseType.GrammarContrastive;
      exercise.source = ExerciseSource.Ai;
      exercise.payload = {
        grammarUsagePointId: item.grammarUsagePointId,
        sentenceId: item.sentenceId,
        ...item.result,
      };
      this.em.persist(exercise);
    }

    this.logger.log(
      {
        postId,
        deterministic: drafts.length,
        grammarContrastive: contrastive.length,
      },
      'ai_exercises generated',
    );

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.AiExercises;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);

    // Final stage in the pipeline chain (PLAN.md §5).
    this.outbox.send<PostPublishJobData>(
      this.em,
      QueueName.PostPublish,
      { postId },
      { singletonKey: postId },
    );
  }

  private async loadTokens(
    sentenceIds: string[],
  ): Promise<Map<string, SentenceToken[]>> {
    const tokens = await this.em.find(
      SentenceToken,
      { sentenceId: { $in: sentenceIds } },
      { orderBy: { position: 'asc' } },
    );
    const bySentence = new Map<string, SentenceToken[]>();
    for (const token of tokens) {
      let list = bySentence.get(token.sentenceId);
      if (!list) {
        list = [];
        bySentence.set(token.sentenceId, list);
      }
      list.push(token);
    }
    return bySentence;
  }

  // One exercise per unique usage point matched in the post (calls run in parallel), built around its
  // first occurrence. A usage point whose category has no other construction
  // has nothing to contrast with and is skipped.
  private async buildContrastive(
    sentences: Sentence[],
    tokensBySentence: Map<string, SentenceToken[]>,
  ): Promise<ContrastiveItem[]> {
    const matches = await this.em.find(GrammarMatch, {
      sentenceId: { $in: sentences.map((s) => s.id) },
    });
    if (matches.length === 0) {
      return [];
    }

    const sentenceOrder = new Map(sentences.map((s, i) => [s.id, i]));
    const firstMatchByPoint = new Map<string, GrammarMatch>();
    for (const match of [...matches].sort(
      (a, b) =>
        (sentenceOrder.get(a.sentenceId) ?? 0) -
          (sentenceOrder.get(b.sentenceId) ?? 0) || a.tokenStart - b.tokenStart,
    )) {
      if (!firstMatchByPoint.has(match.grammarUsagePointId)) {
        firstMatchByPoint.set(match.grammarUsagePointId, match);
      }
    }

    const points = await this.em.find(GrammarUsagePoint, {
      id: { $in: [...firstMatchByPoint.keys()] },
    });
    const pointById = new Map(points.map((p) => [p.id, p]));
    const matchedConstructions = await this.em.find(GrammarConstruction, {
      id: { $in: points.map((p) => p.constructionId) },
    });
    const constructions = await this.em.find(GrammarConstruction, {
      categoryId: { $in: matchedConstructions.map((c) => c.categoryId) },
    });
    const constructionById = new Map(constructions.map((c) => [c.id, c]));
    const siblingPoints = await this.em.find(GrammarUsagePoint, {
      constructionId: { $in: constructions.map((c) => c.id) },
    });
    const guidewordsByConstruction = new Map<string, string[]>();
    for (const point of siblingPoints) {
      const list = guidewordsByConstruction.get(point.constructionId) ?? [];
      list.push(point.guideword);
      guidewordsByConstruction.set(point.constructionId, list);
    }
    const sentenceById = new Map(sentences.map((s) => [s.id, s]));

    const requests: {
      grammarUsagePointId: string;
      sentenceId: string;
      userText: string;
    }[] = [];
    // Map order is first-occurrence order in the post.
    for (const [pointId, match] of firstMatchByPoint) {
      const point = pointById.get(pointId);
      const construction = point && constructionById.get(point.constructionId);
      const sentence = sentenceById.get(match.sentenceId);
      if (!point || !construction || !sentence) {
        continue;
      }
      const siblings = constructions
        .filter(
          (c) =>
            c.categoryId === construction.categoryId &&
            c.id !== construction.id,
        )
        .map((c) => ({
          name: c.name,
          guidewords: guidewordsByConstruction.get(c.id) ?? [],
        }));
      const covered = (tokensBySentence.get(sentence.id) ?? []).filter(
        (t) => t.position >= match.tokenStart && t.position < match.tokenEnd,
      );
      if (siblings.length === 0 || covered.length === 0) {
        this.logger.warn(
          { grammarUsagePointId: point.id, sentenceId: sentence.id },
          'grammar_contrastive skipped: no sibling constructions or covered tokens',
        );
        continue;
      }

      requests.push({
        grammarUsagePointId: point.id,
        sentenceId: sentence.id,
        userText: buildGrammarContrastiveUserText({
          markedSentence: markSentenceSpan(
            sentence.rawText,
            Math.min(...covered.map((t) => t.charStart)),
            Math.max(...covered.map((t) => t.charEnd)),
          ),
          constructionName: construction.name,
          guideword: point.guideword,
          canDoStatement: point.canDoStatement,
          siblings,
        }),
      });
    }

    const items = await Promise.all(
      requests.map(async ({ userText, ...ids }) => {
        const result = await this.completeContrastive(userText, ids);
        return result ? { ...ids, result } : null;
      }),
    );
    return items.filter((item) => item !== null);
  }

  // One usage point's model call, retried on a malformed payload. A point
  // that still fails after the last attempt is skipped: its bad payload must
  // not fail the stage for every other point (a stage retry re-runs all of them).
  private async completeContrastive(
    userText: string,
    ids: { grammarUsagePointId: string; sentenceId: string },
  ): Promise<GrammarContrastiveResult | null> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: each attempt only runs after the previous one failed.
        return await this.ai.completeStructured({
          system: GRAMMAR_CONTRASTIVE_SYSTEM_PROMPT,
          userText,
          tool: {
            name: 'report_grammar_contrastive',
            description:
              'Report the contrastive explanation and multiple-choice question for the marked construction.',
            schema: grammarContrastiveToolSchema,
          },
        });
      } catch (err) {
        if (!(err instanceof AiSchemaMismatchError)) {
          throw err;
        }
        if (attempt >= CONTRASTIVE_MAX_ATTEMPTS) {
          this.logger.warn(
            { err, ...ids, attempts: attempt },
            'grammar_contrastive skipped: model payload failed schema validation',
          );
          return null;
        }
      }
    }
  }
}

interface ContrastiveItem {
  grammarUsagePointId: string;
  sentenceId: string;
  result: GrammarContrastiveResult;
}
