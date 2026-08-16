import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import AuthConfig from '../../../modules/auth/config/auth.config.js';
import { AuthController } from './controllers/auth.controller.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';

@Module({
  imports: [ConfigModule.forFeature(AuthConfig), AuthModule],
  controllers: [AuthController],
  providers: [{ provide: APP_GUARD, useClass: SessionAuthGuard }],
})
export class AuthWebModule {}
