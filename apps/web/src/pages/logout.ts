import type { APIRoute } from 'astro';
import { apiPostRaw } from '../lib/api';

// SiteHeader posts here to sign out. Forward the call to Nest (which
// invalidates the session server-side), then clear the session cookie on the
// way back and send the visitor home.
//
// We re-emit the clearing Set-Cookie ourselves because Nest's clearCookie
// drops the `Secure` attribute, and a `__Host-`-prefixed cookie without
// `Secure` is rejected by the browser — so the cookie would otherwise linger.
const COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? '__Host-session';
const CLEAR_COOKIE = `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export const POST: APIRoute = async ({ request }) => {
  try {
    await apiPostRaw('/auth/logout', undefined, { request });
  } catch {
    // Even if Nest is unreachable, still clear locally and bounce home.
  }
  return new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': CLEAR_COOKIE },
  });
};

export const GET: APIRoute = () =>
  new Response(null, { status: 303, headers: { location: '/' } });
