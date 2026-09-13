import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { ProfileController } from './controllers/profile.controller.js';

@Module({
  imports: [LearningModule, AuthModule],
  controllers: [ProfileController],
})
export class ProfileWebModule {}
