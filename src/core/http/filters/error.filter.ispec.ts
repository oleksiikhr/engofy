import { HttpStatus } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { createWebE2ESuite } from '../../../../test/http/web/setup/e2e-suite.helper.js';
import { InternalWebModule } from '../../../entrypoints/web/internal/internal-web.module.js';
import { ErrorFilter } from './error.filter.js';

describe('ErrorFilter', () => {
  // Nest binds each filter's `catch` before the app boots (during route
  // registration in `app.init()`), so this spy must be installed here, at
  // `describe`-body evaluation time — installing it inside `it()` would be
  // too late to intercept the already-bound reference.
  const catchSpy = vi.spyOn(ErrorFilter.prototype, 'catch');

  const mockHealthCheckService = {
    check: vi.fn(),
  };

  const suite = createWebE2ESuite(
    { imports: [InternalWebModule] },
    {
      builderHook: (builder) =>
        builder
          .overrideProvider(HealthCheckService)
          .useValue(mockHealthCheckService),
    },
  );

  it('returns a generic 500 response for an unhandled error', async () => {
    mockHealthCheckService.check.mockRejectedValueOnce(new Error('Boom'));

    const response = await suite
      .request('get', '/_healthz', { authed: false })
      .expect(HttpStatus.INTERNAL_SERVER_ERROR);

    expect(response.body).toEqual({ message: 'Internal server error' });
    // Pins this test to `ErrorFilter` specifically — if filter registration
    // order or exception type ever changes such that a different filter
    // handles this response instead, this assertion fails even though the
    // response body might coincidentally stay the same.
    expect(catchSpy).toHaveBeenCalledTimes(1);
  });
});
