// Absolute URLs need the public origin. Behind the reverse proxy the request
// URL is the internal one, so prefer PUBLIC_URL (set for every service in
// `.env.production`) and fall back to the request origin in dev.
export function publicOrigin(requestUrl: URL): string {
  return (
    import.meta.env.PUBLIC_URL ??
    process.env.PUBLIC_URL ??
    requestUrl.origin
  ).replace(/\/+$/, '');
}
