import { postUrl } from './post-url';
import type {
  EffectiveState,
  WordDictionaryDetail,
  WordDictionarySense,
} from './types';

// Shared renderer for /dictionary/words/[lemma]'s per-sense action row — used
// both for the initial SSR render and by the /partials/set-disposition and
// /partials/remove-card HTMX responses after an action, so the two never
// drift. Output is injected with set:html; interpolated values are escaped.

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

export function actionsId(wordDefinitionId: string): string {
  return `wd-actions-${wordDefinitionId}`;
}

// A card always wins the effective state (see `resolveEffectiveState`), so a
// sense with an active card only offers "Видалити"; one with no card offers
// the known/skip toggle, each hidden once it would be a no-op re-post of the
// state already showing.
export function senseActionsHtml(
  lemma: string,
  sense: Pick<WordDictionarySense, 'wordDefinitionId' | 'cardId' | 'state'>,
): string {
  const id = actionsId(sense.wordDefinitionId);
  const label = `<span class="wd-sense__state wd-sense__state--${esc(sense.state)}">${esc(STATE_LABEL[sense.state] ?? sense.state)}</span>`;
  const targetField = `<input type="hidden" name="wordDefinitionId" value="${esc(sense.wordDefinitionId)}" />`;

  if (sense.cardId) {
    return `<div class="wd-sense__actions" id="${id}">
      ${label}
      <form hx-post="/partials/remove-card" hx-target="#${id}" hx-swap="outerHTML" hx-confirm="Remove this from your dictionary?">
        <input type="hidden" name="cardId" value="${esc(sense.cardId)}" />
        <input type="hidden" name="lemma" value="${esc(lemma)}" />
        ${targetField}
        <button type="submit" class="btn btn--ghost">Видалити</button>
      </form>
    </div>`;
  }

  const knownBtn =
    sense.state !== 'learned'
      ? `<form hx-post="/partials/set-disposition" hx-target="#${id}" hx-swap="outerHTML">
          ${targetField}
          <input type="hidden" name="lemma" value="${esc(lemma)}" />
          <input type="hidden" name="disposition" value="known" />
          <button type="submit" class="btn btn--ghost">Позначити вивченим</button>
        </form>`
      : '';
  const skipBtn =
    sense.state !== 'skipped'
      ? `<form hx-post="/partials/set-disposition" hx-target="#${id}" hx-swap="outerHTML">
          ${targetField}
          <input type="hidden" name="lemma" value="${esc(lemma)}" />
          <input type="hidden" name="disposition" value="skipped" />
          <button type="submit" class="btn btn--ghost">Пропустити</button>
        </form>`
      : '';

  return `<div class="wd-sense__actions" id="${id}">${label}${knownBtn}${skipBtn}</div>`;
}

function senseHtml(lemma: string, sense: WordDictionarySense): string {
  return `<li class="wd-sense card" data-testid="wd-sense">
    <div class="wd-sense__head">
      <span class="badge">${esc(sense.pos)}</span>
      ${sense.cefrLevel ? `<span class="badge">${esc(sense.cefrLevel)}</span>` : ''}
    </div>
    ${sense.phonetic ? `<p class="wd-sense__phonetic">${esc(sense.phonetic)}</p>` : ''}
    ${sense.definition ? `<p class="wd-sense__def">${esc(sense.definition)}</p>` : ''}
    ${sense.example ? `<p class="wd-sense__eg">“${esc(sense.example)}”</p>` : ''}
    ${senseActionsHtml(lemma, sense)}
  </li>`;
}

function postListHtml(posts: WordDictionaryDetail['posts']): string {
  if (posts.length === 0) {
    return '<p class="wd-posts__empty">Not seen in any post yet.</p>';
  }
  const unread = posts.filter((p) => !p.isRead);
  const read = posts.filter((p) => p.isRead);
  const list = (items: typeof posts) =>
    `<ul class="wd-posts__list">${items
      .map(
        (post) =>
          `<li><a href="${esc(postUrl(post))}">${esc(post.title ?? 'Untitled')}</a></li>`,
      )
      .join('')}</ul>`;

  return `
    ${unread.length ? `<h3>Unread</h3>${list(unread)}` : ''}
    ${read.length ? `<h3>Already read</h3>${list(read)}` : ''}
  `;
}

export function renderWordDetail(view: WordDictionaryDetail): string {
  const senses = `<ul class="wd-sense-list">${view.senses
    .map((sense) => senseHtml(view.lemma, sense))
    .join('')}</ul>`;

  const irregular = view.irregularVerb
    ? `<section class="wd-irregular">
        <h2>Irregular forms</h2>
        <p>Past simple: ${esc(view.irregularVerb.pastSimple.join(', '))}</p>
        <p>Past participle: ${esc(view.irregularVerb.pastParticiple.join(', '))}</p>
      </section>`
    : '';

  return `
    <section class="wd-senses">
      <h2>Senses</h2>
      ${senses}
    </section>
    ${irregular}
    <section class="wd-posts">
      <h2>In your posts</h2>
      ${postListHtml(view.posts)}
    </section>
  `;
}
