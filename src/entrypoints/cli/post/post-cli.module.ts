import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { PostCommand } from './post.command.js';
import { PostBackfillTranslationsCommand } from './post-backfill-translations.command.js';
import { PostDevSeedCommand } from './post-dev-seed.command.js';
import { PostIngestCommand } from './post-ingest.command.js';

@Module({
  imports: [PostModule],
  providers: [
    PostCommand,
    PostIngestCommand,
    PostDevSeedCommand,
    PostBackfillTranslationsCommand,
  ],
})
export class PostCliModule {}
