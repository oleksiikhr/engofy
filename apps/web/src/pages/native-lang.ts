import type { APIRoute } from 'astro';
import { ApiError, apiPatch } from '../lib/api';
import { parseNativeLang } from '../lib/native-lang';
import { getCurrentUser, NATIVE_LANG_COOKIE } from '../lib/session';

// The language picker posts here. The choice is saved on the account when
// signed in, and always written to the cookie (the guest's only store, and the
// fallback when the account has none), then the visitor goes back where they
// were.
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function backTo(request: Request): string {
  const referer = request.headers.get('referer');
  if (!referer) {
    return '/';
  }
  const url = new URL(referer);
  return url.origin === new URL(request.url).origin
    ? `${url.pathname}${url.search}`
    : '/';
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const lang = parseNativeLang(form.get('nativeLang'));
  if (!lang) {
    return new Response(null, { status: 400 });
  }
  if (await getCurrentUser(request)) {
    try {
      await apiPatch('/profile/native-lang', { nativeLang: lang }, { request });
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }
      return new Response(null, { status: 502 });
    }
  }
  return new Response(null, {
    status: 303,
    headers: {
      location: backTo(request),
      'set-cookie': `${NATIVE_LANG_COOKIE}=${lang}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; Secure; SameSite=Lax`,
    },
  });
};

export const GET: APIRoute = () =>
  new Response(null, { status: 303, headers: { location: '/' } });
