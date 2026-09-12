import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { PostService } from '../../../modules/post/post.service.js';
import { CliCommandRunner } from '../cli-command.runner.js';

@SubCommand({
  name: 'backfill-enrichment',
  description:
    'Enqueue the enrichment stage (PLAN.md §17) for every published post that has no completed run yet — for posts published before the stage existed',
})
export class PostBackfillEnrichmentCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly postService: PostService) {
    super();
  }

  protected async execute(): Promise<void> {
    const { enqueued } = await this.postService.backfillEnrichment();

    this.logger.log({ enqueued }, 'enrichment backfill enqueued');
  }
}
