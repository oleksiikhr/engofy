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
import { ContentPipelineRunStatus } from '../enums/content-pipeline-run-status.enum.js';
import { ContentPipelineStage } from '../enums/content-pipeline-stage.enum.js';

@Entity({ tableName: 'content_pipeline_runs' })
@Unique({ properties: ['contentId', 'stage'] })
export class ContentPipelineRun {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  contentId!: string;

  @Enum(() => ContentPipelineStage)
  stage!: ContentPipelineStage;

  @Enum({ items: () => ContentPipelineRunStatus })
  status: Opt<ContentPipelineRunStatus> = ContentPipelineRunStatus.Pending;

  @Property({ type: LuxonTimestampType, nullable: true })
  completedAt?: DateTime | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
