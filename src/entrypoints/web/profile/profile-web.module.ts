import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { BillingModule } from '../../../modules/billing/billing.module.js';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { ProfileController } from './controllers/profile.controller.js';

@Module({
  imports: [LearningModule, AuthModule, BillingModule],
  controllers: [ProfileController],
})
export class ProfileWebModule {}
