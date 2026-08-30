import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../../modules/auth/auth.module.js';
import AuthConfig from '../../../modules/auth/config/auth.config.js';
import { AuthController } from './controllers/auth.controller.js';

// The global `SessionAuthGuard` `APP_GUARD` lives in `web.module.ts` (D14) so
// it applies regardless of which sub-modules are composed.
@Module({
  imports: [ConfigModule.forFeature(AuthConfig), AuthModule],
  controllers: [AuthController],
})
export class AuthWebModule {}
