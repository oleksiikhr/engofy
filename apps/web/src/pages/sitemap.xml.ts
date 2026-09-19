import type { APIRoute } from 'astro';
import { apiGet } from '../lib/api';
import { buildGrammarSitemap, grammarSlugs } from '../lib/grammar-seo';
import type { GrammarReference } from '../lib/types';

// Absolute URLs need the public origin. Behind the reverse proxy the request
// URL is the internal one, so prefer PUBLIC_URL (set for every service in
// `.env.production`) and fall back to the request origin in dev.
export const GET: APIRoute = async ({ url }) => {
  const origin = (
    import.meta.env.PUBLIC_URL ??
    process.env.PUBLIC_URL ??
    url.origin
  ).replace(/\/+$/, '');
  const reference = await apiGet<GrammarReference>('/content/grammar');
  return new Response(buildGrammarSitemap(origin, grammarSlugs(reference)), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
