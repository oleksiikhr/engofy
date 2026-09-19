import type { APIRoute } from 'astro';
import { ApiError, apiGet } from '../../lib/api';
import { renderDictionaryResults } from '../../lib/dictionary-list';
import type { DictionaryResponse } from '../../lib/types';

// HTMX target for /dictionary's filter form and "Next" link — same query
// params (`state`, `search`, `cursor`) as the real page, so the two share
// one query-building convention and never drift on what a page looks like.

function html(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const state = url.searchParams.get('state') ?? '';
  const search = url.searchParams.get('search') ?? '';
  const query = { state, search };

  const qs = url.searchParams.toString();
  try {
    const view = await apiGet<DictionaryResponse>(
      `/dictionary${qs ? `?${qs}` : ''}`,
      { request },
    );
    return html(renderDictionaryResults(view, query), {
      // Keeps the address bar / back-button in sync with the real page even
      // though this response only carries a fragment.
      'HX-Push-Url': `/dictionary${qs ? `?${qs}` : ''}`,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return html(
        '<p><a href="/login">Sign in</a> to see your dictionary.</p>',
      );
    }
    return html(
      '<div class="dict-empty card card--soft"><p>Could not load your dictionary — try again.</p></div>',
    );
  }
};
