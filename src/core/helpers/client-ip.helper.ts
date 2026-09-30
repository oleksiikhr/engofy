import { isIP } from 'node:net';
import type { FastifyInstance } from 'fastify';

// Behind Cloudflare the real visitor address arrives in `CF-Connecting-IP`,
// which Cloudflare overwrites on every request. `X-Forwarded-For` cannot be
// used instead: Fastify would need a hop count or the proxies' addresses, and
// the DigitalOcean edge has neither stable. Set `CLIENT_IP_HEADER` only where
// every request comes through a proxy that owns that header — otherwise a
// direct caller could spoof its address.
export function registerClientIpHook(
  fastify: FastifyInstance,
  header: string | undefined,
): void {
  if (!header) {
    return;
  }

  const name = header.toLowerCase();

  fastify.addHook('onRequest', async (request) => {
    const value = request.headers[name];
    const ip = typeof value === 'string' ? value.trim() : '';

    if (isIP(ip) !== 0) {
      // `ip` is a prototype getter on Fastify's Request; an own property shadows it.
      Object.defineProperty(request, 'ip', { value: ip, configurable: true });
    }
  });
}
