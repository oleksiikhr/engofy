import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { LearningController } from './controllers/learning.controller.js';

@Module({
  imports: [LearningModule, AuthModule],
  controllers: [LearningController],
})
export class LearningWebModule {}
