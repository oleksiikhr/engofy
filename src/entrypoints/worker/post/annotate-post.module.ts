import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { AnnotatePostProcessor } from './annotate-post.processor.js';

@Module({
  imports: [PostModule],
  providers: [AnnotatePostProcessor],
})
export class AnnotatePostModule {}
