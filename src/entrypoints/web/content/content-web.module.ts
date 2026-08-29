import { Module } from '@nestjs/common';
import { PostModule } from '../../../modules/post/post.module.js';
import { ContentController } from './controllers/content.controller.js';

@Module({
  imports: [PostModule],
  controllers: [ContentController],
})
export class ContentWebModule {}
