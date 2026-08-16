import { Module } from '@nestjs/common';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import { SendChallengeEmailProcessor } from './send-challenge-email.processor.js';

@Module({
  imports: [AuthModule],
  providers: [SendChallengeEmailProcessor],
})
export class SendChallengeEmailModule {}
