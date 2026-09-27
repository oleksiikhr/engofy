import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { PostCommand } from './post.command.js';
import { PostDevSeedCommand } from './post-dev-seed.command.js';
import { PostIngestCommand } from './post-ingest.command.js';

@Module({
  imports: [PostModule],
  providers: [PostCommand, PostIngestCommand, PostDevSeedCommand],
})
export class PostCliModule {}
