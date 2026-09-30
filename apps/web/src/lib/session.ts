import { ApiError, apiGet } from './api';
import {
  DEFAULT_NATIVE_LANG,
  type NativeLang,
  parseNativeLang,
} from './native-lang';
import type { CurrentUser } from './types';

// Name of the cookie a guest's native-language choice lives in (same variable
// as the backend's).
export const NATIVE_LANG_COOKIE =
  process.env.AUTH_NATIVE_LANG_COOKIE_NAME ?? 'native-lang';

const currentUsers = new WeakMap<Request, Promise<CurrentUser | null>>();

// Resolves the signed-in user from the forwarded session cookie, or null for a
// guest. 401 (no / expired session) is the normal guest path, not an error.
// Memoized per request: a page and its Layout both ask.
export function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  let user = currentUsers.get(request);
  if (!user) {
    user = fetchCurrentUser(request);
    currentUsers.set(request, user);
  }
  return user;
}

async function fetchCurrentUser(request: Request): Promise<CurrentUser | null> {
  try {
    return await apiGet<CurrentUser>('/auth/me', { request });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 404)
    ) {
      return null;
    }
    throw error;
  }
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return null;
}

// Same order as the backend's resolver: the account, else the guest cookie,
// else the default.
export async function resolveNativeLang(request: Request): Promise<NativeLang> {
  const user = await getCurrentUser(request);
  return (
    user?.nativeLang ??
    parseNativeLang(readCookie(request, NATIVE_LANG_COOKIE)) ??
    DEFAULT_NATIVE_LANG
  );
}
