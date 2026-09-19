import { type PracticeType, typesQuery } from './practice-filter';
import type { PracticeItem, PracticeQueueResponse } from './types';

// Shared renderer for the /practice queue — used both for the initial SSR
// render and by the /partials/review HTMX response after each grade, so the
// two never drift. Output is injected with set:html; interpolated values are
// escaped here.

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

const GRADES: { rating: string; label: string }[] = [
  { rating: 'again', label: 'Again' },
  { rating: 'hard', label: 'Hard' },
  { rating: 'good', label: 'Good' },
  { rating: 'easy', label: 'Easy' },
];

// A card that has never been reviewed has nothing to rate "hard"/"easy"
// against, so it gets a plain got-it / again choice; the backend accepts any
// `ReviewRating` either way.
const NEW_CARD_GRADES: { rating: string; label: string }[] = [
  { rating: 'again', label: 'Повтор' },
  { rating: 'good', label: 'Вивчив' },
];

const TYPE_LABEL: Record<string, string> = {
  word: 'Word',
  phrase: 'Phrase',
  grammar: 'Grammar',
};

// The reveal panel's inner markup for a word/phrase/grammar card that has a
// `secondary` (definition or can-do statement) to show. Phonetic (word-only)
// and the 🔊 button sit next to the definition; the context sentence (a real
// sentence from something the learner actually read, PLAN.md
// practice-redesign зріз 1 — never a fallback to the AI example) gets its own
// line with a source label.
function speakButton(text: string): string {
  return `<button type="button" class="btn btn--ghost practice__speak" data-speak="${esc(text)}" aria-label="Pronounce: ${esc(text)}">🔊</button>`;
}

function renderContext(target: PracticeItem['target']): string {
  return target.contextSentence
    ? `<blockquote class="practice__context">
        <p>${esc(target.contextSentence)}${speakButton(target.contextSentence)}</p>
        <cite>from an article you read</cite>
      </blockquote>`
    : '';
}

// Grammar reveal (practice-redesign зріз 3): can-do statement, the EGP
// example, a real sentence from a recent read when one matched, and a plain
// link to the construction's page. Recall format only — no contrastive
// question here.
function renderGrammarAnswerBody(target: PracticeItem['target']): string {
  const example = target.exampleText
    ? `<p class="practice__example">${esc(target.exampleText)}</p>`
    : '';
  const more = target.detailSlug
    ? `<p><a class="practice__more" href="/grammar/${encodeURIComponent(target.detailSlug)}">Детальніше</a></p>`
    : '';
  return `<p>${esc(target.secondary ?? '')}</p>${example}${renderContext(target)}${more}`;
}

function renderAnswerBody(target: PracticeItem['target']): string {
  if (target.type === 'grammar') {
    return renderGrammarAnswerBody(target);
  }
  const phonetic = target.phonetic
    ? ` <span class="practice__phonetic">${esc(target.phonetic)}</span>`
    : '';
  return `<p>${esc(target.secondary ?? '')}${phonetic}${speakButton(target.primary)}</p>${renderContext(target)}`;
}

function renderCard(
  card: PracticeItem,
  remaining: number,
  partialUrl = '/partials/review',
  target = '#practice-container',
  types: readonly PracticeType[] = [],
): string {
  const t = card.target;
  const grades = card.state === 'new' ? NEW_CARD_GRADES : GRADES;
  const buttons = grades
    .map(
      (g, i) =>
        `<button type="submit" name="rating" value="${g.rating}" class="btn practice__grade" aria-keyshortcuts="${i + 1}">${g.label} <kbd class="practice__key" aria-hidden="true">${i + 1}</kbd></button>`,
    )
    .join('');

  const reveal = t.secondary
    ? `<button type="button" class="btn btn--ghost practice__reveal" aria-keyshortcuts="Space">Show answer <kbd class="practice__key" aria-hidden="true">␣</kbd></button>
       <div class="practice__answer" hidden>${renderAnswerBody(t)}</div>`
    : `<p class="practice__answer practice__answer--self">Recall its meaning, then grade yourself.</p>`;

  return `<div class="practice__card" data-testid="practice-card">
    <p class="practice__count">${remaining} card${remaining === 1 ? '' : 's'} to review</p>
    <p class="practice__kicker">${esc(t.type === 'grammar' && t.kicker ? t.kicker : (TYPE_LABEL[t.type] ?? t.type))}</p>
    <p class="practice__front">${esc(t.primary)}</p>
    ${reveal}
    <form
      hx-post="${partialUrl}"
      hx-target="${target}"
      hx-swap="innerHTML"
      class="practice__grades"
    >
      <input type="hidden" name="cardId" value="${esc(card.cardId)}" />
      ${types.length > 0 ? `<input type="hidden" name="types" value="${types.join(',')}" />` : ''}
      ${buttons}
    </form>
  </div>`;
}

// The queue emptied out but the daily new-card cap held some back
// (practice-redesign зріз 2) — explains why, and offers to lift it for the
// rest of this session (never touches the free-tier 100-card cap).
function renderDailyLimitReached(
  heldBackNewCount: number,
  types: readonly PracticeType[],
): string {
  const moreQuery = typesQuery(types);
  const plural = heldBackNewCount === 1 ? '' : 's';
  return `<div class="practice__done" data-testid="practice-done">
    <p class="practice__done-emoji">✓</p>
    <h2>Daily new-card limit reached</h2>
    <p>${heldBackNewCount} more new card${plural} waiting — come back tomorrow, or keep going now.</p>
    <button
      type="button"
      class="btn btn--ghost"
      hx-get="/partials/practice-more${moreQuery ? `?${moreQuery}` : ''}"
      hx-target="#practice-container"
      hx-swap="innerHTML"
    >Show ${heldBackNewCount} more new</button>
  </div>`;
}

// The user has never added a card (as opposed to having cleared the queue).
function renderEmpty(): string {
  return `<div class="practice__done" data-testid="practice-empty">
    <p class="practice__done-emoji">📚</p>
    <h2>No cards yet</h2>
    <p>Save words, phrases and grammar while you read — they show up here for review. <a href="/">Find something to read</a>.</p>
  </div>`;
}

function renderDone(): string {
  return `<div class="practice__done" data-testid="practice-done">
    <p class="practice__done-emoji">✓</p>
    <h2>All caught up</h2>
    <p>No cards are due right now. Come back later or <a href="/">read something new</a>.</p>
  </div>`;
}

// `types` is the active /practice filter (empty = all): it rides along on the
// grade form and the "show more" button so the next card stays inside it.
export function renderPracticeQueue(
  response: PracticeQueueResponse,
  types: readonly PracticeType[] = [],
): string {
  if (response.items.length === 0) {
    if (!response.hasAnyCards) {
      return renderEmpty();
    }
    return response.heldBackNewCount > 0
      ? renderDailyLimitReached(response.heldBackNewCount, types)
      : renderDone();
  }
  return renderCard(
    response.items[0],
    response.items.length,
    undefined,
    undefined,
    types,
  );
}

// Крок 2 of the daily session (daily-session-home plan, зріз 4) — same card
// markup, but grading posts to `/partials/daily-review` (scoped to today's
// post) and finishing the queue moves on to крок 3 instead of linking away.
export function renderDailyPracticeQueue(cards: PracticeItem[]): string {
  if (cards.length === 0) {
    return `<div class="practice__done" data-testid="practice-done">
      <p class="practice__done-emoji">✓</p>
      <h2>All caught up</h2>
      <p><a href="/?step=3">Continue →</a></p>
    </div>`;
  }
  return renderCard(
    cards[0],
    cards.length,
    '/partials/daily-review',
    '#daily-practice-container',
  );
}
