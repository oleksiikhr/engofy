import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { GenerateExercisesProcessor } from './generate-exercises.processor.js';

@Module({
  imports: [PostModule],
  providers: [GenerateExercisesProcessor],
})
export class GenerateExercisesModule {}
