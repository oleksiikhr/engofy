import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import AuthConfig from '../../../modules/auth/config/auth.config.js';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { DictionaryController } from './controllers/dictionary.controller.js';

@Module({
  imports: [ConfigModule.forFeature(AuthConfig), AuthModule, LearningModule],
  controllers: [DictionaryController],
})
export class DictionaryWebModule {}
