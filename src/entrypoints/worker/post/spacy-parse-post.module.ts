import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { SpacyParsePostProcessor } from './spacy-parse-post.processor.js';

@Module({
  imports: [PostModule],
  providers: [SpacyParsePostProcessor],
})
export class SpacyParsePostModule {}
