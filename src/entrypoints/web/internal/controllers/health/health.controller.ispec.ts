import { HttpStatus } from '@nestjs/common';
import type { HealthCheckResult } from '@nestjs/terminus';
import { createWebE2ESuite } from '../../../../../../test/http/web/setup/e2e-suite.helper.js';
import { InternalWebModule } from '../../internal-web.module.js';

describe('HealthController', () => {
  describe('/_healthz (GET)', () => {
    const suite = createWebE2ESuite({ imports: [InternalWebModule] });

    it('should return application health status', async () => {
      const response = await suite
        .request('get', '/_healthz', { authed: false })
        .expect(HttpStatus.OK);

      const body = response.body as HealthCheckResult;

      expect(body.status).toBe('ok');
      expect(body.info?.database?.status).toBe('up');
      expect(body.info?.redis?.status).toBe('up');
    });
  });
});
