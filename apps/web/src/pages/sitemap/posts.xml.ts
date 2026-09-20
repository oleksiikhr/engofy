import type { APIRoute } from 'astro';
import { apiGet } from '../../lib/api';
import { publicOrigin } from '../../lib/site';
import { buildSitemapIndex, sitemapResponse } from '../../lib/sitemap';
import type { PostsSitemapIndex } from '../../lib/types';

// Index over the posts sitemap pages. The public files are 0-based
// (`posts-0.xml`), the API's pages are 1-based.
export const GET: APIRoute = async ({ url }) => {
  const origin = publicOrigin(url);
  const { pages } = await apiGet<PostsSitemapIndex>('/content/sitemap/posts');
  return sitemapResponse(
    buildSitemapIndex(
      pages.map(({ page, lastmod }) => ({
        loc: `${origin}/sitemap/posts-${page - 1}.xml`,
        lastmod,
      })),
    ),
  );
};
