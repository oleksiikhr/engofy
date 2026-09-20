import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { EnrichGrammarProcessor } from './enrich-grammar.processor.js';

@Module({
  imports: [PostModule],
  providers: [EnrichGrammarProcessor],
})
export class EnrichGrammarModule {}
