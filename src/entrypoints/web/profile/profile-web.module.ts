import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { BillingModule } from '../../../modules/billing/billing.module.js';
import { HomeModule } from '../../../modules/home/home.module.js';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { ProfileController } from './controllers/profile.controller.js';

@Module({
  imports: [LearningModule, AuthModule, BillingModule, HomeModule],
  controllers: [ProfileController],
})
export class ProfileWebModule {}
