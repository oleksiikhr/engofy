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
  buildExercises,
  type ExerciseSentenceInput,
} from '../../domain/build-exercises.js';
import {
  buildComprehensionUserText,
  COMPREHENSION_SYSTEM_PROMPT,
  comprehensionToolSchema,
} from '../../domain/comprehension-prompt.js';
import { Exercise } from '../../entities/exercise.entity.js';
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

export interface PostAiExercisesJobData {
  postId: string;
}

// ai_exercises stage (PLAN.md §5, §3.10): most exercises are built
// deterministically from `sentence_tokens` (build-exercises.ts, no AI);
// comprehension questions come from one structured AI call. Reads the spaCy
// `sentences` / `sentence_tokens`, so it runs after ai_grammar (enqueued by
// TagGrammarHandler on completion). Idempotent via the stage-level
// PostPipelineRun row (§12); a partial re-run rebuilds every exercise for the
// post.
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
    const comprehension = await this.callComprehension(
      sentences.map((s) => s.rawText),
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

    for (const question of comprehension.questions) {
      const exercise = new Exercise();
      exercise.postId = postId;
      exercise.type = ExerciseType.Comprehension;
      exercise.source = ExerciseSource.Ai;
      exercise.payload = { ...question };
      this.em.persist(exercise);
    }

    this.logger.log(
      {
        postId,
        deterministic: drafts.length,
        comprehension: comprehension.questions.length,
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

  private async callComprehension(
    sentenceTexts: string[],
  ): Promise<ReturnType<typeof comprehensionToolSchema.parse>> {
    return this.ai.completeStructured({
      system: COMPREHENSION_SYSTEM_PROMPT,
      userText: buildComprehensionUserText(sentenceTexts),
      tool: {
        name: 'report_comprehension',
        description:
          'Report the reading-comprehension questions for the passage.',
        schema: comprehensionToolSchema,
      },
    });
  }
}
