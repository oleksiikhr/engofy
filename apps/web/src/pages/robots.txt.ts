import type { APIRoute } from 'astro';
import { publicOrigin } from '../lib/site';

// Only routes with nothing to index are disallowed. `/login`, `/profile`,
// `/practice`, … stay crawlable so the crawler can read their `noindex`.
export const GET: APIRoute = ({ url }) => {
  const body = [
    'User-agent: *',
    'Disallow: /api/',
    'Disallow: /partials/',
    'Disallow: /logout',
    '',
    `Sitemap: ${publicOrigin(url)}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
