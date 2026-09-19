import type { APIRoute } from 'astro';
import { apiGet } from '../../lib/api';
import type { PostSuggestionsResponse } from '../../lib/types';

// HTMX target for the /posts search box's <datalist>: word/phrase completions
// for the prefix typed so far. Best-effort — any failure just leaves the list
// empty rather than surfacing an error in the middle of typing.

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

function options(body: string): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const q = (url.searchParams.get('term') ?? '').trim();
  if (!q) {
    return options('');
  }
  try {
    const view = await apiGet<PostSuggestionsResponse>(
      `/content/posts/suggestions?${new URLSearchParams({ q })}`,
      { request },
    );
    return options(
      view.items
        .map(
          (item) =>
            `<option value="${esc(item.text)}" label="${esc(item.type)}"></option>`,
        )
        .join(''),
    );
  } catch {
    return options('');
  }
};
