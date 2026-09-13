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
  // Deletion only takes effect when every attribute matches the cookie that
  // was set — mirror `setSessionCookie`.
  reply.clearCookie(config.sessionCookieName, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
}

export function readSessionCookie(
  request: FastifyRequest,
  config: AuthConfigType,
): string | undefined {
  return request.cookies[config.sessionCookieName];
}

// Short-lived, one-shot signal for the frontend's post-signup onboarding
// screen — not a persistent column, so it carries no state past its TTL.
// Readable client-side (not `httpOnly`): the frontend consuming it decides
// when to clear it, which is out of scope here.
export function setOnboardingCookie(
  reply: FastifyReply,
  config: AuthConfigType,
): void {
  reply.setCookie(config.onboardingCookieName, '1', {
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: Math.floor(config.onboardingCookieTtlMs / 1000),
  });
}
