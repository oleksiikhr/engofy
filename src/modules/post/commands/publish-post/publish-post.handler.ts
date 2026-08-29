import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPublication } from '../../entities/post-publication.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PublicationPlatform } from '../../enums/publication-platform.enum.js';
import { PublicationStatus } from '../../enums/publication-status.enum.js';
import { PublishPostCommand } from './publish-post.command.js';

export interface PostPublishJobData {
  postId: string;
}

// publish stage (PLAN.md §5): the terminal pipeline step. Flips
// posts.status = published and enqueues a pending post_publications row per
// target channel — V1 only telegram (§3.8, §10); the actual send is the
// Telegram bot's job (Slice 5). Idempotent via the stage-level
// PostPipelineRun row (§12); the publication upsert is 'ignore' on conflict
// so a re-run never resets a row a later send step already advanced.
@CommandHandler(PublishPostCommand)
export class PublishPostHandler implements ICommandHandler<PublishPostCommand> {
  private readonly logger = new Logger(PublishPostHandler.name);

  constructor(private readonly em: EntityManager) {}

  async execute(command: PublishPostCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Publish,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    const post = await this.em.findOneOrFail(Post, postId);
    post.status = PostStatus.Published;
    post.publishedAt = DateTime.now();

    await this.em.upsert(
      PostPublication,
      {
        id: uuidv7(),
        postId,
        platform: PublicationPlatform.Telegram,
        status: PublicationStatus.Pending,
      },
      {
        onConflictFields: ['postId', 'platform'],
        onConflictAction: 'ignore',
      },
    );

    this.logger.log({ postId }, 'post published');

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.Publish;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);

    await this.em.flush();
  }
}
