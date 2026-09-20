import type { APIRoute } from 'astro';
import { publicOrigin } from '../lib/site';
import { buildSitemapIndex, sitemapResponse } from '../lib/sitemap';

// Root sitemap: one index over the static pages and the paginated posts.
export const GET: APIRoute = ({ url }) => {
  const origin = publicOrigin(url);
  return sitemapResponse(
    buildSitemapIndex([
      { loc: `${origin}/sitemap/static.xml` },
      { loc: `${origin}/sitemap/posts.xml` },
    ]),
  );
};
