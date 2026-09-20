import type { EffectiveState } from './types';

// Renderer for one grammar usage point's action row on /grammar/[slug] — used
// for the initial SSR render (via set:html) and by the
// /partials/grammar-usage-point HTMX response, so the two never drift.
// Interpolated values are escaped.

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

export const USAGE_ACTIONS_MESSAGE = {
  signIn: '<a href="/login">Sign in</a> to save this.',
  deckFull:
    'Free deck is full — <a href="/pricing">go Premium</a> for unlimited cards.',
  failed: 'Could not save, try again.',
} as const;

export function usageActionsId(usagePointId: string): string {
  return `gup-actions-${usagePointId}`;
}

// A point that is still New offers both actions; any other state is settled
// (a card, a known or a skip disposition) and shows just its label. A New
// point below the learner's level (`assumedKnown`) keeps both actions and is
// labelled "Assumed known". `message` is trusted HTML from
// `USAGE_ACTIONS_MESSAGE` — never user input.
export function usageActionsHtml(
  usagePointId: string,
  state: EffectiveState,
  message?: string,
  assumedKnown = false,
): string {
  const id = usageActionsId(usagePointId);
  const assumed = state === 'new' && assumedKnown;
  const text = assumed ? 'Assumed known' : (STATE_LABEL[state] ?? state);
  const label = `<span class="gup-state gup-state--${assumed ? 'assumed' : esc(state)}" data-state="${assumed ? 'assumed' : esc(state)}">${esc(text)}</span>`;
  const note = message
    ? `<span class="add-card__msg" role="status">${message}</span>`
    : '';

  if (state !== 'new') {
    return `<div class="gup-actions" id="${id}">${label}</div>`;
  }

  const form = (action: 'add' | 'known', text: string, extra = '') =>
    `<form hx-post="/partials/grammar-usage-point" hx-target="#${id}" hx-swap="outerHTML">
      <input type="hidden" name="grammarUsagePointId" value="${esc(usagePointId)}" />
      <input type="hidden" name="action" value="${action}" />
      <button type="submit" class="btn btn--sm ${extra}">${text}</button>
    </form>`;

  return `<div class="gup-actions" id="${id}">
    ${label}
    ${form('add', '+ Add to deck')}
    ${form('known', 'I know this', 'btn--sec')}
    ${note}
  </div>`;
}
