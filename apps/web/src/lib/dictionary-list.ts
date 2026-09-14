import { postUrl } from './post-url';
import type {
  DictionaryEntry,
  DictionaryResponse,
  EffectiveState,
} from './types';

// Shared renderer for /dictionary's results — used both for the initial SSR
// render and by the /partials/dictionary HTMX response after a filter change
// or a "Next" page, so the two never drift. Output is injected with
// set:html; interpolated values are escaped here.

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

const STATE_LABEL: Record<EffectiveState, string> = {
  new: 'New',
  learning: 'Learning',
  learned: 'Learned',
  skipped: 'Skipped',
};

export interface DictionaryQuery {
  state: string;
  search: string;
}

// The same filter params travel on every "Next" link/partial request, so
// paging never drops the filter that produced the page.
function withQuery(
  query: DictionaryQuery,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams();
  if (query.state) {
    params.set('state', query.state);
  }
  if (query.search) {
    params.set('search', query.search);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      params.set(key, value);
    }
  }
  return params.toString();
}

// `/dictionary/[lemma]` / `/dictionary/[phrase]` (dictionary-redesign plan
// prose) can't both be single-segment dynamic routes under the same parent
// in Astro's file router — they'd collide. This slice links to
// `/dictionary/words/<lemma>` and `/dictionary/phrases/<phrase>` instead;
// whichever slice builds those detail pages should use these same two paths.
function entryHref(entry: DictionaryEntry): string {
  const base =
    entry.type === 'word' ? '/dictionary/words/' : '/dictionary/phrases/';
  return `${base}${encodeURIComponent(entry.primary)}`;
}

function entryHtml(entry: DictionaryEntry): string {
  const senseNote =
    entry.type === 'word' && entry.senseCount > 1
      ? `<span class="dict-entry__senses">${entry.senseCount} senses</span>`
      : '';
  const posts =
    entry.posts.length > 0
      ? `<p class="dict-entry__posts">Appears in: ${entry.posts
          .map(
            (post) =>
              `<a href="${esc(postUrl(post))}">${esc(post.title ?? 'Untitled')}</a>`,
          )
          .join(', ')}</p>`
      : '';

  return `<li class="dict-entry card" data-testid="dict-entry">
    <div class="dict-entry__head">
      <a class="dict-entry__term" href="${esc(entryHref(entry))}">${esc(entry.primary)}</a>
      <span class="badge">${esc(entry.type)}</span>
      ${entry.cefrLevel ? `<span class="badge">${esc(entry.cefrLevel)}</span>` : ''}
      ${senseNote}
      <span class="dict-entry__state dict-entry__state--${esc(entry.state)}">${esc(STATE_LABEL[entry.state] ?? entry.state)}</span>
    </div>
    ${entry.secondary ? `<p class="dict-entry__pos">${esc(entry.secondary)}</p>` : ''}
    ${entry.definition ? `<p class="dict-entry__def">${esc(entry.definition)}</p>` : ''}
    ${entry.example ? `<p class="dict-entry__eg">“${esc(entry.example)}”</p>` : ''}
    ${posts}
  </li>`;
}

function renderNext(view: DictionaryResponse, query: DictionaryQuery): string {
  if (!view.nextCursor) {
    return '';
  }
  const qs = withQuery(query, { cursor: view.nextCursor });
  return `<p class="dict-more">
    <a
      class="btn btn--ghost"
      href="/dictionary?${qs}"
      hx-get="/partials/dictionary?${qs}"
      hx-target="#dict-results"
      hx-swap="innerHTML"
      hx-push-url="true"
    >Next →</a>
  </p>`;
}

export function renderDictionaryResults(
  view: DictionaryResponse,
  query: DictionaryQuery,
): string {
  if (view.items.length === 0) {
    const message =
      query.search || query.state
        ? 'No entries match.'
        : 'Nothing saved yet — tap the “+” on a word while reading to add it here.';
    return `<p class="dict-empty">${esc(message)}</p>`;
  }

  const list = `<ul class="dict-list" id="dict-items">${view.items
    .map(entryHtml)
    .join('')}</ul>`;
  return `${list}${renderNext(view, query)}`;
}
