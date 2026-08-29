import { Module } from '@nestjs/common';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { DictionaryController } from './controllers/dictionary.controller.js';

@Module({
  imports: [LearningModule],
  controllers: [DictionaryController],
})
export class DictionaryWebModule {}
