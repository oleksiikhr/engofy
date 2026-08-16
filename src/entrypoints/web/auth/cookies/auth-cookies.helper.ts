import type { ConfigType } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type AuthConfig from '../../../../modules/auth/config/auth.config.js';

type AuthConfigType = ConfigType<typeof AuthConfig>;

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  config: AuthConfigType,
): void {
  reply.setCookie(config.sessionCookieName, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  });
}

export function clearSessionCookie(
  reply: FastifyReply,
  config: AuthConfigType,
): void {
  reply.clearCookie(config.sessionCookieName, { path: '/' });
}

export function readSessionCookie(
  request: FastifyRequest,
  config: AuthConfigType,
): string | undefined {
  return request.cookies[config.sessionCookieName];
}
