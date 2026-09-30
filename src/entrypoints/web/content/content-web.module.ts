import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import AuthConfig from '../../../modules/auth/config/auth.config.js';
import { PostModule } from '../../../modules/post/post.module.js';
import { ContentController } from './controllers/content.controller.js';

@Module({
  imports: [ConfigModule.forFeature(AuthConfig), AuthModule, PostModule],
  controllers: [ContentController],
})
export class ContentWebModule {}
