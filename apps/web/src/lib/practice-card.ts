import type { PracticeItem } from './types';

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
function renderAnswerBody(target: PracticeItem['target']): string {
  const phonetic = target.phonetic
    ? ` <span class="practice__phonetic">${esc(target.phonetic)}</span>`
    : '';
  const speak =
    target.type !== 'grammar'
      ? `<button type="button" class="btn btn--ghost practice__speak" data-speak="${esc(target.primary)}" aria-label="Pronounce ${esc(target.primary)}">🔊</button>`
      : '';
  const context = target.contextSentence
    ? `<blockquote class="practice__context">
        <p>${esc(target.contextSentence)}</p>
        <cite>from an article you read</cite>
      </blockquote>`
    : '';

  return `<p>${esc(target.secondary ?? '')}${phonetic}${speak}</p>${context}`;
}

function renderCard(card: PracticeItem, remaining: number): string {
  const t = card.target;
  const buttons = GRADES.map(
    (g) =>
      `<button type="submit" name="rating" value="${g.rating}" class="btn practice__grade">${g.label}</button>`,
  ).join('');

  const reveal = t.secondary
    ? `<button type="button" class="btn btn--ghost practice__reveal">Show answer</button>
       <div class="practice__answer" hidden>${renderAnswerBody(t)}</div>`
    : `<p class="practice__answer practice__answer--self">Recall its meaning, then grade yourself.</p>`;

  return `<div class="practice__card" data-testid="practice-card">
    <p class="practice__count">${remaining} card${remaining === 1 ? '' : 's'} to review</p>
    <p class="practice__kicker">${esc(TYPE_LABEL[t.type] ?? t.type)}</p>
    <p class="practice__front">${esc(t.primary)}</p>
    ${reveal}
    <form
      hx-post="/partials/review"
      hx-target="#practice-container"
      hx-swap="innerHTML"
      class="practice__grades"
    >
      <input type="hidden" name="cardId" value="${esc(card.cardId)}" />
      ${buttons}
    </form>
  </div>`;
}

function renderDone(): string {
  return `<div class="practice__done" data-testid="practice-done">
    <p class="practice__done-emoji">✓</p>
    <h2>All caught up</h2>
    <p>No cards are due right now. Come back later or <a href="/">read something new</a>.</p>
  </div>`;
}

export function renderPracticeQueue(cards: PracticeItem[]): string {
  if (cards.length === 0) {
    return renderDone();
  }
  return renderCard(cards[0], cards.length);
}
