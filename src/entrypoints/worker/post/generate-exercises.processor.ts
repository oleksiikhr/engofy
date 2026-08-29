import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAiExercisesJobData } from '../../../modules/post/commands/generate-exercises/generate-exercises.handler.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

@Injectable()
export class GenerateExercisesProcessor extends JobWorkerHost<PostAiExercisesJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected async processJob(job: Job<PostAiExercisesJobData>): Promise<void> {
    await this.postService.generateExercises(job.data.postId);
  }
}
