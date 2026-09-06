import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { TagGrammarProcessor } from './tag-grammar.processor.js';

@Module({
  imports: [PostModule],
  providers: [TagGrammarProcessor],
})
export class TagGrammarModule {}
