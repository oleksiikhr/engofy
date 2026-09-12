import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { EnrichLexiconProcessor } from './enrich-lexicon.processor.js';

@Module({
  imports: [PostModule],
  providers: [EnrichLexiconProcessor],
})
export class EnrichLexiconModule {}
