import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { PublishPostProcessor } from './publish-post.processor.js';

@Module({
  imports: [PostModule],
  providers: [PublishPostProcessor],
})
export class PublishPostModule {}
