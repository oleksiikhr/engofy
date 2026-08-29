// SSR-side calls to the Nest API. Astro pages run this on the server, so the
// browser never talks to Nest directly — it goes through the reverse proxy
// (prod) or the Vite `/api` proxy (dev). Here we hit Nest at its own origin
// and forward the visitor's session cookie.

// Nest web server origin. Default matches the repo's dev PORT (8080); set
// API_ORIGIN in each environment.
const API_ORIGIN = import.meta.env.API_ORIGIN ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`API ${path} responded ${status}`);
    this.name = 'ApiError';
  }
}

export interface ApiCallOptions extends Omit<RequestInit, 'headers'> {
  // The incoming Astro request, so its Cookie header is forwarded to Nest.
  request?: Request;
  headers?: Record<string, string>;
}

async function call(
  path: string,
  { request, headers = {}, ...init }: ApiCallOptions = {},
): Promise<Response> {
  const merged = new Headers(headers);
  const cookie = request?.headers.get('cookie');
  if (cookie) {
    merged.set('cookie', cookie);
  }
  return fetch(new URL(path, API_ORIGIN), { ...init, headers: merged });
}

// GET JSON. Throws ApiError on any non-2xx (callers catch 401/404 as needed).
export async function apiGet<T>(
  path: string,
  options: ApiCallOptions = {},
): Promise<T> {
  const res = await call(path, { ...options, method: 'GET' });
  if (!res.ok) {
    throw new ApiError(res.status, path);
  }
  return (await res.json()) as T;
}

// GET JSON, returning null instead of throwing on 404.
export async function apiGetOrNull<T>(
  path: string,
  options: ApiCallOptions = {},
): Promise<T | null> {
  try {
    return await apiGet<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// POST JSON and parse a JSON reply. Throws ApiError on any non-2xx so callers
// can branch on 401 (guest) / 400 (validation, card limit) themselves.
export async function apiPost<T>(
  path: string,
  body: unknown,
  options: ApiCallOptions = {},
): Promise<T> {
  const hasBody = body !== undefined;
  const res = await call(path, {
    ...options,
    method: 'POST',
    body: hasBody ? JSON.stringify(body) : undefined,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, path);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// POST JSON and return the raw Response — for auth flows where the caller
// needs Nest's Set-Cookie header to forward it onto the Astro response.
export async function apiPostRaw(
  path: string,
  body: unknown,
  options: ApiCallOptions = {},
): Promise<Response> {
  const hasBody = body !== undefined;
  return call(path, {
    ...options,
    method: 'POST',
    body: hasBody ? JSON.stringify(body) : undefined,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isBadRequest(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400;
}
