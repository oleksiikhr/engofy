import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { PostPipelineRunStatus } from '../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../enums/post-pipeline-stage.enum.js';

@Entity({ tableName: 'post_pipeline_runs' })
@Unique({ properties: ['postId', 'stage'] })
export class PostPipelineRun {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  postId!: string;

  @Enum(() => PostPipelineStage)
  stage!: PostPipelineStage;

  @Enum({ items: () => PostPipelineRunStatus })
  status: Opt<PostPipelineRunStatus> = PostPipelineRunStatus.Pending;

  @Property({ type: LuxonTimestampType, nullable: true })
  startedAt?: DateTime | null;

  @Property({ type: LuxonTimestampType, nullable: true })
  completedAt?: DateTime | null;

  // Last failure message for this stage, cleared on a successful rerun.
  @Property({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Property({ type: 'integer', default: 0 })
  retryCount: Opt<number> = 0;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
