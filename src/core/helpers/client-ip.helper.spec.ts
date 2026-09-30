import Fastify from 'fastify';
import { registerClientIpHook } from './client-ip.helper.js';

async function ipSeenBy(
  header: string | undefined,
  headers: Record<string, string>,
): Promise<string> {
  const fastify = Fastify();

  registerClientIpHook(fastify, header);
  fastify.get('/', async (request) => request.ip);

  const response = await fastify.inject({ url: '/', headers });

  await fastify.close();

  return response.body;
}

describe('registerClientIpHook', () => {
  it('uses the configured header as request.ip', async () => {
    await expect(
      ipSeenBy('CF-Connecting-IP', { 'cf-connecting-ip': '203.0.113.7' }),
    ).resolves.toBe('203.0.113.7');
  });

  it('accepts IPv6 addresses', async () => {
    await expect(
      ipSeenBy('cf-connecting-ip', { 'cf-connecting-ip': '2001:db8::1' }),
    ).resolves.toBe('2001:db8::1');
  });

  it('keeps the socket address when the header is absent', async () => {
    await expect(ipSeenBy('cf-connecting-ip', {})).resolves.toBe('127.0.0.1');
  });

  it('keeps the socket address when the header is not an IP', async () => {
    await expect(
      ipSeenBy('cf-connecting-ip', { 'cf-connecting-ip': 'not-an-ip' }),
    ).resolves.toBe('127.0.0.1');
  });

  it('ignores the header when no header name is configured', async () => {
    await expect(
      ipSeenBy(undefined, { 'cf-connecting-ip': '203.0.113.7' }),
    ).resolves.toBe('127.0.0.1');
  });
});
