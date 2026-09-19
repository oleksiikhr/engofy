import { STATE_LABEL, STATE_TONE } from './dictionary-state';
import { postUrl } from './post-url';
import type {
  EffectiveState,
  PhraseDictionaryDetail,
  WordDictionaryDetail,
  WordDictionarySense,
} from './types';

// Shared renderer for /dictionary/words/[lemma]'s per-sense and
// /dictionary/phrases/[phrase]'s action row — used both for the initial SSR
// render and by the /partials/set-disposition and /partials/remove-card HTMX
// responses after an action, so the two never drift. Output is injected with
// set:html; interpolated values are escaped.

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

// What an action row acts on: one word sense (`lemma` is the detail page's
// route param, needed to re-fetch after a removal) or one phrase.
export type ActionTarget =
  | { kind: 'word'; wordDefinitionId: string; lemma: string }
  | { kind: 'phrase'; phraseId: string; phraseText: string };

// Parses the hidden target fields `targetFields` renders back into a target.
export function readActionTarget(form: FormData): ActionTarget | null {
  const wordDefinitionId = form.get('wordDefinitionId');
  const lemma = form.get('lemma');
  if (typeof wordDefinitionId === 'string' && typeof lemma === 'string') {
    return { kind: 'word', wordDefinitionId, lemma };
  }
  const phraseId = form.get('phraseId');
  const phrase = form.get('phrase');
  if (typeof phraseId === 'string' && typeof phrase === 'string') {
    return { kind: 'phrase', phraseId, phraseText: phrase };
  }
  return null;
}

interface ActionState {
  cardId: string | null;
  state: EffectiveState;
}

export function actionsId(target: ActionTarget): string {
  return target.kind === 'word'
    ? `wd-actions-${target.wordDefinitionId}`
    : `pd-actions-${target.phraseId}`;
}

function targetFields(target: ActionTarget): string {
  return target.kind === 'word'
    ? `<input type="hidden" name="wordDefinitionId" value="${esc(target.wordDefinitionId)}" />
        <input type="hidden" name="lemma" value="${esc(target.lemma)}" />`
    : `<input type="hidden" name="phraseId" value="${esc(target.phraseId)}" />
        <input type="hidden" name="phrase" value="${esc(target.phraseText)}" />`;
}

// A card always wins the effective state (see `resolveEffectiveState`), so a
// target with an active card only offers "Видалити"; one with no card offers
// the known/skip toggle, each hidden once it would be a no-op re-post of the
// state already showing.
export function actionsHtml(
  target: ActionTarget,
  current: ActionState,
): string {
  const id = actionsId(target);
  const fields = targetFields(target);
  const label = `<span class="tag ${STATE_TONE[current.state] ?? ''}">${esc(STATE_LABEL[current.state] ?? current.state)}</span>`;

  if (current.cardId) {
    return `<div class="wd-sense__actions" id="${id}">
      ${label}
      <form hx-post="/partials/remove-card" hx-target="#${id}" hx-swap="outerHTML" hx-confirm="Remove this from your dictionary?">
        <input type="hidden" name="cardId" value="${esc(current.cardId)}" />
        ${fields}
        <button type="submit" class="btn btn--sm btn--danger">Видалити</button>
      </form>
    </div>`;
  }

  const dispositionForm = (disposition: 'known' | 'skipped', text: string) =>
    `<form hx-post="/partials/set-disposition" hx-target="#${id}" hx-swap="outerHTML">
          ${fields}
          <input type="hidden" name="disposition" value="${disposition}" />
          <button type="submit" class="btn btn--sm btn--sec">${text}</button>
        </form>`;
  const knownBtn =
    current.state !== 'learned'
      ? dispositionForm('known', 'Позначити вивченим')
      : '';
  const skipBtn =
    current.state !== 'skipped' ? dispositionForm('skipped', 'Пропустити') : '';

  return `<div class="wd-sense__actions" id="${id}">${label}${knownBtn}${skipBtn}</div>`;
}

export function senseActionsHtml(
  lemma: string,
  sense: Pick<WordDictionarySense, 'wordDefinitionId' | 'cardId' | 'state'>,
): string {
  return actionsHtml(
    { kind: 'word', wordDefinitionId: sense.wordDefinitionId, lemma },
    sense,
  );
}

function senseHtml(lemma: string, sense: WordDictionarySense): string {
  return `<li class="wd-sense card" data-testid="wd-sense">
    <div class="wd-sense__head">
      <span class="eyebrow">${esc(sense.pos)}</span>
      ${sense.cefrLevel ? `<span class="badge">${esc(sense.cefrLevel)}</span>` : ''}
    </div>
    ${sense.phonetic ? `<p class="wd-sense__phonetic">${esc(sense.phonetic)}</p>` : ''}
    ${sense.definition ? `<p class="wd-sense__def">${esc(sense.definition)}</p>` : ''}
    ${sense.example ? `<p class="wd-sense__eg">“${esc(sense.example)}”</p>` : ''}
    ${senseActionsHtml(lemma, sense)}
  </li>`;
}

function postListHtml(
  posts: WordDictionaryDetail['posts'] | PhraseDictionaryDetail['posts'],
): string {
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

export function renderPhraseDetail(view: PhraseDictionaryDetail): string {
  const target: ActionTarget = {
    kind: 'phrase',
    phraseId: view.phraseId,
    phraseText: view.phraseText,
  };
  return `
    <section class="wd-senses">
      <div class="wd-sense card" data-testid="pd-phrase">
        <div class="wd-sense__head">
          ${view.type ? `<span class="eyebrow">${esc(view.type)}</span>` : ''}
          ${view.cefrLevel ? `<span class="badge">${esc(view.cefrLevel)}</span>` : ''}
        </div>
        ${view.definition ? `<p class="wd-sense__def">${esc(view.definition)}</p>` : ''}
        ${view.example ? `<p class="wd-sense__eg">“${esc(view.example)}”</p>` : ''}
        ${actionsHtml(target, view)}
      </div>
    </section>
    <section class="wd-posts">
      <h2>In your posts</h2>
      ${postListHtml(view.posts)}
    </section>
  `;
}
