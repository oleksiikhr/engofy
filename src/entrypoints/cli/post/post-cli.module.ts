import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { PostCommand } from './post.command.js';
import { PostIngestCommand } from './post-ingest.command.js';

@Module({
  imports: [PostModule],
  providers: [PostCommand, PostIngestCommand],
})
export class PostCliModule {}
