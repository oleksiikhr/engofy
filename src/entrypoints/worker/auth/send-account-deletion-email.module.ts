import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { SendAccountDeletionEmailProcessor } from './send-account-deletion-email.processor.js';

@Module({
  imports: [AuthModule],
  providers: [SendAccountDeletionEmailProcessor],
})
export class SendAccountDeletionEmailModule {}
