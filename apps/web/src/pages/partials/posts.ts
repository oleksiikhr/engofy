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
import { LEVEL_COOKIE, pickedLevel } from '../../lib/reader-level';
import { getCurrentUser } from '../../lib/session';
import type { PostsListResponse } from '../../lib/types';

// HTMX target for /posts — the filter form (no `cursor`: replaces the whole
// results block) and the "Show more" row (`cursor`: replaces that row with
// the next cards). Same query params as the real page.

function html(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

export const GET: APIRoute = async ({ request, url, cookies }) => {
  const query = parsePostsQuery(url.searchParams);

  try {
    const signedIn = (await getCurrentUser(request)) !== null;
    const view = await apiGet<PostsListResponse>(
      `/content/posts?${toApiQuery(query)}`,
      { request },
    );
    if (query.cursor) {
      return html(renderPostsPage(view, query, signedIn));
    }
    const params = new URLSearchParams(url.searchParams);
    // No level chip left checked means "all levels" — recorded in the address
    // so a reload doesn't bring the guest's level default back.
    if (
      query.cefr.length === 0 &&
      pickedLevel(cookies.get(LEVEL_COOKIE)?.value)
    ) {
      params.set('all', '1');
    }
    const qs = params.toString();
    return html(renderPostsResults(view, query, signedIn), {
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
