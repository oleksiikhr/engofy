import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { BillingModule } from '../../../modules/billing/billing.module.js';
import { LearningModule } from '../../../modules/learning/learning.module.js';
import { LearningController } from './controllers/learning.controller.js';

@Module({
  imports: [LearningModule, AuthModule, BillingModule],
  controllers: [LearningController],
})
export class LearningWebModule {}
