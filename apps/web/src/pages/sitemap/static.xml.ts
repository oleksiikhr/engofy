import type { APIRoute } from 'astro';
import { apiGet } from '../../lib/api';
import { grammarSlugs } from '../../lib/grammar-seo';
import { publicOrigin } from '../../lib/site';
import { buildUrlset, sitemapResponse } from '../../lib/sitemap';
import type { GrammarReference } from '../../lib/types';

// Public pages with no per-page change time, so no `<lastmod>`.
export const GET: APIRoute = async ({ url }) => {
  const origin = publicOrigin(url);
  const reference = await apiGet<GrammarReference>('/content/grammar');
  const paths = [
    '/',
    '/posts',
    '/pricing',
    '/grammar',
    ...grammarSlugs(reference).map(
      (slug) => `/grammar/${encodeURIComponent(slug)}`,
    ),
  ];
  return sitemapResponse(
    buildUrlset(paths.map((path) => ({ loc: `${origin}${path}` }))),
  );
};
