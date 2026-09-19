import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { DeleteExpiredAccountsCron } from './delete-expired-accounts.cron.js';

@Module({
  imports: [AuthModule],
  providers: [DeleteExpiredAccountsCron],
})
export class AuthCronModule {}
