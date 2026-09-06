import { Module } from '@nestjs/common';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { ProfileController } from './controllers/profile.controller.js';

@Module({
  imports: [LearningModule],
  controllers: [ProfileController],
})
export class ProfileWebModule {}
