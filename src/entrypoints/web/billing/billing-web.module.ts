import { Module } from '@nestjs/common';
import { BillingModule } from '../../../modules/billing/billing.module.js';
import { BillingController } from './controllers/billing.controller.js';

@Module({
  imports: [BillingModule],
  controllers: [BillingController],
})
export class BillingWebModule {}
