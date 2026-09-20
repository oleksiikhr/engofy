import { defineMiddleware } from 'astro:middleware';

// Service routes that return fragments or redirects, never a page to index.
function isServiceRoute(pathname: string): boolean {
  return pathname.startsWith('/partials/') || pathname === '/logout';
}

export const onRequest = defineMiddleware(async ({ url }, next) => {
  const response = await next();
  if (isServiceRoute(url.pathname)) {
    response.headers.set('x-robots-tag', 'noindex');
  }
  return response;
});
