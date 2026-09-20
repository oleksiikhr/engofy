import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { GetPostPipelineStatusQuery } from './get-post-pipeline-status.query.js';
import type {
  PostPipelineStatusListView,
  PostStageStatusView,
} from './post-pipeline-status-view.js';

const STAGE_ORDER = Object.values(PostPipelineStage);

// Backs the admin Telegram `/status` command: per-post stage progress from
// `post_pipeline_runs`. Two queries — the posts, then all their runs at once.
@QueryHandler(GetPostPipelineStatusQuery)
export class GetPostPipelineStatusHandler
  implements IQueryHandler<GetPostPipelineStatusQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    postId,
    limit,
  }: GetPostPipelineStatusQuery): Promise<PostPipelineStatusListView> {
    const posts = await this.em.find(
      Post,
      postId === null
        ? { status: { $in: [PostStatus.Processing, PostStatus.Failed] } }
        : { id: postId },
      { orderBy: { createdAt: 'desc', id: 'desc' }, limit },
    );
    if (posts.length === 0) {
      return { items: [] };
    }

    const runs = await this.em.find(PostPipelineRun, {
      postId: { $in: posts.map((post) => post.id) },
    });
    const stagesByPost = new Map<string, PostStageStatusView[]>();
    for (const run of runs) {
      const stages = stagesByPost.get(run.postId) ?? [];
      stages.push({
        stage: run.stage,
        status: run.status,
        retryCount: run.retryCount,
        errorMessage: run.errorMessage ?? null,
      });
      stagesByPost.set(run.postId, stages);
    }

    return {
      items: posts.map((post) => ({
        id: post.id,
        shortId: post.shortId,
        title: post.title ?? null,
        status: post.status,
        createdAt: post.createdAt,
        stages: (stagesByPost.get(post.id) ?? []).sort(
          (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
        ),
      })),
    };
  }
}
