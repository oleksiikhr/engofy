import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { AssessComplexityProcessor } from './assess-complexity.processor.js';

@Module({
  imports: [PostModule],
  providers: [AssessComplexityProcessor],
})
export class AssessComplexityModule {}
