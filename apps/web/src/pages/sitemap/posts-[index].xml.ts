import type { APIRoute } from 'astro';
import { ApiError, apiGet } from '../../lib/api';
import { postUrl } from '../../lib/post-url';
import { publicOrigin } from '../../lib/site';
import { buildUrlset, sitemapResponse } from '../../lib/sitemap';
import type { PostsSitemapPage } from '../../lib/types';

// `posts-0.xml` is the first page of posts; the API's page number is 1-based.
export const GET: APIRoute = async ({ params, url }) => {
  const index = params.index ?? '';
  if (!/^\d+$/.test(index)) {
    return new Response(null, { status: 404 });
  }
  let page: PostsSitemapPage;
  try {
    page = await apiGet<PostsSitemapPage>(
      `/content/sitemap/posts/${Number(index) + 1}`,
    );
  } catch (error) {
    // 404: past the last page. 400: beyond the API's page cap.
    if (error instanceof ApiError && [400, 404].includes(error.status)) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
  const origin = publicOrigin(url);
  return sitemapResponse(
    buildUrlset(
      page.items.map((item) => ({
        loc: `${origin}${postUrl(item)}`,
        lastmod: item.lastmod,
      })),
    ),
  );
};
