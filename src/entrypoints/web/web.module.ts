import { type DynamicModule, Module, type Type } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces/modules/module-metadata.interface.js';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ETagInterceptor } from '../../core/http/interceptors/etag.interceptor.js';
import { AuthModule } from '../../modules/auth/auth.module.js';
import AuthConfig from '../../modules/auth/config/auth.config.js';
import { AuthWebModule } from './auth/auth-web.module.js';
import { SessionAuthGuard } from './auth/guards/session-auth.guard.js';
import { BillingWebModule } from './billing/billing-web.module.js';
import { ContentWebModule } from './content/content-web.module.js';
import { DictionaryWebModule } from './dictionary/dictionary-web.module.js';
import { InternalWebModule } from './internal/internal-web.module.js';
import { LearningWebModule } from './learning/learning-web.module.js';
import { ProfileWebModule } from './profile/profile-web.module.js';
import { WebThrottlerModule } from './throttler/web-throttler.module.js';

const DEFAULT_SUB_MODULES: Type[] = [
  InternalWebModule,
  AuthWebModule,
  LearningWebModule,
  BillingWebModule,
  ProfileWebModule,
  ContentWebModule,
  DictionaryWebModule,
];

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (forRoot/forFeature)
export class WebModule {
  static forRoot(
    subModules: ModuleMetadata['imports'] = DEFAULT_SUB_MODULES,
  ): DynamicModule {
    return {
      module: WebModule,
      imports: [
        ConfigModule.forFeature(AuthConfig),
        AuthModule,
        // First, so `ThrottlerGuard` (its own `APP_GUARD`) runs before the
        // session guard below.
        WebThrottlerModule,
        ...subModules,
      ],
      // The global guards + interceptor live here, not in a sub-module: every
      // route is rate-limited + authenticated (`@Public()` opts out of auth)
      // and ETag-aware no matter which sub-modules `forRoot` is given (D14).
      providers: [
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_INTERCEPTOR, useClass: ETagInterceptor },
      ],
    };
  }
}
