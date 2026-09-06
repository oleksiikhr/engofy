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
  buildComplexityUserText,
  COMPLEXITY_SYSTEM_PROMPT,
  complexityToolSchema,
  indexComplexityLevels,
} from '../../domain/complexity-prompt.js';
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
// every sentence on the CEFR scale. Reads the spaCy `sentences` rows, so it
// runs after spacy_parse (enqueued by SpacyParsePostHandler on completion).
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

    const assessment = await this.ai.completeStructured({
      system: COMPLEXITY_SYSTEM_PROMPT,
      userText: buildComplexityUserText(sentences.map((s) => s.rawText)),
      tool: {
        name: 'report_complexity',
        description:
          'Report the overall and per-sentence CEFR level of the passage plus the new-vocabulary ratio.',
        schema: complexityToolSchema,
      },
    });

    const levels = indexComplexityLevels(assessment, sentences.length);
    sentences.forEach((sentence, i) => {
      sentence.cefrLevel = levels[i];
    });
    post.cefrLevel = assessment.overall;

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
