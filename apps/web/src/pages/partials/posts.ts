import type { APIRoute } from 'astro';
import { apiGet, isBadRequest } from '../../lib/api';
import {
  POSTS_ERROR_HTML,
  POSTS_INVALID_HTML,
  parsePostsQuery,
  renderPostsPage,
  renderPostsResults,
  toApiQuery,
} from '../../lib/posts-list';
import type { PostsListResponse } from '../../lib/types';

// HTMX target for /posts — the filter form (no `cursor`: replaces the whole
// results block) and the "Show more" row (`cursor`: replaces that row with
// the next cards). Same query params as the real page.

function html(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const query = parsePostsQuery(url.searchParams);

  try {
    const view = await apiGet<PostsListResponse>(
      `/content/posts?${toApiQuery(query)}`,
      { request },
    );
    if (query.cursor) {
      return html(renderPostsPage(view, query));
    }
    const qs = new URLSearchParams(url.searchParams).toString();
    return html(renderPostsResults(view, query), {
      // Keeps the address bar / back-button in sync with the real page even
      // though this response only carries a fragment.
      'HX-Push-Url': `/posts${qs ? `?${qs}` : ''}`,
    });
  } catch (error) {
    if (isBadRequest(error)) {
      return html(POSTS_INVALID_HTML);
    }
    return html(POSTS_ERROR_HTML);
  }
};
