import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import {
  AI_CLIENT,
  type AiClient,
} from '../../../../core/ai/ai-client.port.js';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import {
  buildComplexitySystemPrompt,
  buildComplexityUserText,
  type ComplexityAssessment,
  complexityToolSchema,
  complexityToolSchemaWithTitle,
  indexComplexityLevels,
} from '../../domain/complexity-prompt.js';
import { generateSlug } from '../../domain/generate-slug.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import type { PostAiGrammarJobData } from '../tag-grammar/tag-grammar.handler.js';
import { AssessComplexityCommand } from './assess-complexity.command.js';

export interface PostAiComplexityJobData {
  postId: string;
}

// ai_complexity stage (PLAN.md §5): one AI call scores the whole post and
// every sentence on the CEFR scale and writes a meta description — plus, when
// the post reached this stage with no title (no explicit title, no leading H1
// at ingest), a generated title too, so `Post.title` is never left null.
// Reads the spaCy `sentences` rows, so it runs after spacy_parse (enqueued by
// SpacyParsePostHandler on completion).
// Idempotent via the stage-level PostPipelineRun row (§12).
@CommandHandler(AssessComplexityCommand)
export class AssessComplexityHandler
  implements ICommandHandler<AssessComplexityCommand>
{
  private readonly logger = new Logger(AssessComplexityHandler.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: AssessComplexityCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiComplexity,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    const post = await this.em.findOneOrFail(Post, postId);

    const sentences = await this.em.find(
      Sentence,
      { postId },
      { orderBy: { postPartId: 'asc', unitIndex: 'asc', position: 'asc' } },
    );
    if (sentences.length === 0) {
      throw new Error(
        `ai_complexity needs spacy_parse output — no sentences for post ${postId}`,
      );
    }

    // No explicit title and no leading H1 at ingest (IngestPostHandler) — this
    // stage is also where a title gets generated, never left null.
    const needsTitle = post.title == null;
    const assessment = await this.ai.completeStructured<ComplexityAssessment>({
      system: buildComplexitySystemPrompt(needsTitle),
      userText: buildComplexityUserText(sentences.map((s) => s.rawText)),
      tool: {
        name: 'report_complexity',
        description: needsTitle
          ? 'Report the overall and per-sentence CEFR level of the passage, the new-vocabulary ratio, a meta description and a title.'
          : 'Report the overall and per-sentence CEFR level of the passage, the new-vocabulary ratio and a meta description.',
        schema: needsTitle
          ? complexityToolSchemaWithTitle
          : complexityToolSchema,
      },
    });

    const levels = indexComplexityLevels(assessment, sentences.length);
    sentences.forEach((sentence, i) => {
      sentence.cefrLevel = levels[i];
    });
    post.cefrLevel = assessment.overall;
    post.metaDescription = assessment.metaDescription;
    if (needsTitle && assessment.title) {
      post.title = assessment.title;
      post.slug = generateSlug(assessment.title);
    }

    this.logger.log(
      {
        postId,
        overall: assessment.overall,
        newVocabRatio: assessment.newVocabRatio,
        sentences: sentences.length,
      },
      'ai_complexity assessed',
    );

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.AiComplexity;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);

    // Next stage in the pipeline chain (PLAN.md §5).
    this.outbox.send<PostAiGrammarJobData>(
      this.em,
      QueueName.PostAiGrammar,
      { postId },
      { singletonKey: postId },
    );
  }
}
