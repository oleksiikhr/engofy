import { formatDate } from './format-date';
import { postUrl } from './post-url';
import type { CefrLevel, PostsListItem, PostsListResponse } from './types';

// Shared by /posts (initial SSR render) and /partials/posts (HTMX filter
// changes and "Show more"), so the two never drift. Output is injected with
// set:html; interpolated values are escaped here.

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const MAX_LIMIT = 50;

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function esc(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

export interface PostsQuery {
  cefr: CefrLevel[];
  term: string;
  unreadOnly: boolean;
  cursor: string;
  limit: number | null;
}

// The form submits one `cefr` param per checked chip (`?cefr=A1&cefr=B1`);
// a comma-separated `cefr=A1,B1` (the API's own shape) is read the same way.
export function parsePostsQuery(params: URLSearchParams): PostsQuery {
  const cefr = params
    .getAll('cefr')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value): value is CefrLevel =>
      (CEFR_LEVELS as string[]).includes(value),
    );
  const limit = Number.parseInt(params.get('limit') ?? '', 10);
  return {
    cefr: CEFR_LEVELS.filter((level) => cefr.includes(level)),
    term: (params.get('term') ?? '').trim(),
    unreadOnly: ['true', 'on', '1'].includes(params.get('unreadOnly') ?? ''),
    cursor: params.get('cursor') ?? '',
    limit: limit >= 1 ? Math.min(limit, MAX_LIMIT) : null,
  };
}

// Query string for `GET /content/posts`.
export function toApiQuery(query: PostsQuery): string {
  const params = new URLSearchParams();
  if (query.cefr.length > 0) {
    params.set('cefr', query.cefr.join(','));
  }
  if (query.term) {
    params.set('term', query.term);
  }
  if (query.unreadOnly) {
    params.set('unreadOnly', 'true');
  }
  if (query.cursor) {
    params.set('cursor', query.cursor);
  }
  if (query.limit) {
    params.set('limit', String(query.limit));
  }
  return params.toString();
}

// Query string for a browser-facing `/posts` URL, in the form's own shape.
// The same filters travel on every "Show more" link, so paging never drops
// the filter that produced the page.
function toBrowserQuery(query: PostsQuery, cursor: string): string {
  const params = new URLSearchParams();
  for (const level of query.cefr) {
    params.append('cefr', level);
  }
  if (query.term) {
    params.set('term', query.term);
  }
  if (query.unreadOnly) {
    params.set('unreadOnly', 'true');
  }
  if (query.limit) {
    params.set('limit', String(query.limit));
  }
  params.set('cursor', cursor);
  return params.toString();
}

function safeHref(link: string | null): string | null {
  return link && /^https?:\/\//i.test(link) ? link : null;
}

// A signed-in reader sees each card's read state (Read / New); a guest has
// none, so their cards carry no state tag.
function cardHtml(post: PostsListItem, signedIn: boolean): string {
  const sourceHref = safeHref(post.sourceLink);
  const attribution = sourceHref
    ? `<a href="${esc(sourceHref)}" rel="noopener noreferrer" target="_blank">${esc(post.attributionText)}</a>`
    : esc(post.attributionText);
  const href = esc(postUrl(post));

  let state = '';
  if (post.isRead) {
    state =
      '<span class="tag tone-green post-card__state" data-testid="post-read">✓ Read</span>';
  } else if (signedIn) {
    state = '<span class="tag tone-blue post-card__state">New</span>';
  }
  const cta = post.isRead
    ? '<a class="btn btn--sm btn--sec" href="{href}" tabindex="-1" aria-hidden="true">Read again</a>'
    : '<a class="btn btn--sm" href="{href}" tabindex="-1" aria-hidden="true">Read</a>';

  return `<li class="post-card card" data-testid="post-card">
    <div class="post-card__head">
      ${post.cefrLevel ? `<span class="badge${post.isRead ? '' : ' badge--solid'}">${esc(post.cefrLevel)}</span>` : ''}
      ${state}
    </div>
    <h2 class="post-card__title"><a href="${href}">${esc(post.title ?? 'Untitled')}</a></h2>
    ${post.excerpt ? `<p class="post-card__excerpt">${esc(post.excerpt)}</p>` : ''}
    <p class="post-card__source">${attribution}</p>
    <div class="post-card__foot">
      <time class="meta" datetime="${esc(post.publishedAt)}">${esc(formatDate(post.publishedAt))}</time>
      ${cta.replace('{href}', href)}
    </div>
  </li>`;
}

function moreHtml(view: PostsListResponse, query: PostsQuery): string {
  if (!view.nextCursor) {
    return '';
  }
  const qs = toBrowserQuery(query, view.nextCursor);
  return `<li class="posts-more">
    <a
      class="btn btn--ghost"
      href="/posts?${qs}"
      hx-get="/partials/posts?${qs}"
      hx-target="closest li"
      hx-swap="outerHTML"
    >Show more</a>
  </li>`;
}

// Cards plus the trailing "Show more" row — what a follow-up page swaps in
// for the previous "Show more" row.
export function renderPostsPage(
  view: PostsListResponse,
  query: PostsQuery,
  signedIn: boolean,
): string {
  return `${view.items.map((post) => cardHtml(post, signedIn)).join('')}${moreHtml(view, query)}`;
}

export function renderPostsResults(
  view: PostsListResponse,
  query: PostsQuery,
  signedIn: boolean,
): string {
  if (view.items.length === 0) {
    const filtered =
      query.cefr.length > 0 || query.term !== '' || query.unreadOnly;
    const message = filtered
      ? 'No posts match. A word or phrase must be picked from the suggestions.'
      : 'No posts yet.';
    return `<div class="posts-empty card card--soft" data-testid="posts-empty"><p>${esc(message)}</p></div>`;
  }
  return `<ul class="posts-list" id="posts-items">${renderPostsPage(view, query, signedIn)}</ul>`;
}

export const POSTS_ERROR_HTML =
  '<div class="posts-empty card card--soft" data-testid="posts-empty"><p>Could not load posts — try again.</p></div>';

export const POSTS_INVALID_HTML =
  '<div class="posts-empty card card--soft" data-testid="posts-empty"><p>Those filters are not valid — clear them and try again.</p></div>';
