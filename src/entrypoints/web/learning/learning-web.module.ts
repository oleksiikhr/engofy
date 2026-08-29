import { Module } from '@nestjs/common';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { LearningController } from './controllers/learning.controller.js';

@Module({
  imports: [LearningModule],
  controllers: [LearningController],
})
export class LearningWebModule {}
