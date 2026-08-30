import { type INestApplication, RequestMethod } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { createZodValidationPipe } from 'nestjs-zod';
import { AuthorizationErrorFilter } from '../../core/http/filters/authorization-error.filter.js';
import { DomainErrorFilter } from '../../core/http/filters/domain-error.filter.js';
import { ErrorFilter } from '../../core/http/filters/error.filter.js';
import { HealthCheckErrorFilter } from '../../core/http/filters/health-check-error.filter.js';
import { HttpErrorFilter } from '../../core/http/filters/http-error.filter.js';
import { EmptyStringToNullPipe } from '../../core/pipes/empty-string-to-null.pipe.js';
import { zodValidationExceptionFactory } from '../../core/validation/zod-validation-exception.factory.js';

const ZodValidationPipe = createZodValidationPipe({
  createValidationException: zodValidationExceptionFactory,
});

// Single source of truth for the web request pipeline — global prefix, pipes,
// filters. `main.ts` (production) and the web ispec harness
// (`test/http/web/setup/create-app.helper.ts`) both call this so the two can
// never drift (D17).
export function configureApp(app: INestApplication): void {
  // The public API is served under `/api`. The edge proxy also strips the
  // prefix, so `/api/feed` (direct) and `/feed` (proxied) both resolve.
  // `_healthz` is probed by the platform at the root and stays unprefixed.
  app.setGlobalPrefix('api', {
    exclude: [{ path: '_healthz', method: RequestMethod.ALL }],
  });

  const reflector = app.get(Reflector);

  app.useGlobalPipes(
    new EmptyStringToNullPipe(reflector),
    new ZodValidationPipe(),
  );

  app.useGlobalFilters(
    new ErrorFilter(app.get(HttpAdapterHost)),
    new HttpErrorFilter(),
    new DomainErrorFilter(),
    new AuthorizationErrorFilter(),
    new HealthCheckErrorFilter(),
  );
}
