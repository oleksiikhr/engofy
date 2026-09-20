import { Factory } from '@mikro-orm/seeder';
import { PostPipelineRun } from '../../src/modules/post/entities/post-pipeline-run.entity.js';
import { PostPipelineStage } from '../../src/modules/post/enums/post-pipeline-stage.enum.js';

// `postId` has no default — pass the owning post's id. `stage` is unique per
// post, so set it explicitly when a post has several runs.
export class PostPipelineRunFactory extends Factory<PostPipelineRun> {
  readonly model = PostPipelineRun;

  protected definition() {
    return { stage: PostPipelineStage.SpacyParse };
  }
}
