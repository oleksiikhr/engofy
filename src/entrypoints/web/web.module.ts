import { type DynamicModule, Module, type Type } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces/modules/module-metadata.interface.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ETagInterceptor } from '../../core/http/interceptors/etag.interceptor.js';
import { AuthWebModule } from './auth/auth-web.module.js';
import { BillingWebModule } from './billing/billing-web.module.js';
import { ContentWebModule } from './content/content-web.module.js';
import { DictionaryWebModule } from './dictionary/dictionary-web.module.js';
import { InternalWebModule } from './internal/internal-web.module.js';
import { LearningWebModule } from './learning/learning-web.module.js';
import { ProfileWebModule } from './profile/profile-web.module.js';

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
      imports: subModules,
      providers: [{ provide: APP_INTERCEPTOR, useClass: ETagInterceptor }],
    };
  }
}
