// The exercises section under one usage point on `/grammar/{slug}`
// (grammar-usage-point-exercises plan, slice 5) — renders that point's
// reusable exercise pool (slice 2/3), reusing the reader Quick check card's
// step shapes (`quick-check-steps.ts`) and CSS (`.qc__*`, app.css) so the
// look and the answer-checking pattern don't diverge. Unlike Quick check,
// each exercise here is answered independently — a static list, not a
// question-by-question session — so there is no progress bar, skip or
// "Continue" button; `lib/usage-point-exercises-client.ts` drives the
// checking.
import { type QuickCheckStep, toDrill } from './quick-check-steps';
import type { UsagePointExercise } from './types';

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

export function usagePointDrillSteps(
  exercises: UsagePointExercise[],
): QuickCheckStep[] {
  return exercises
    .map(toDrill)
    .filter((step): step is QuickCheckStep => step !== null);
}

type ChooseStep = Extract<QuickCheckStep, { kind: 'choose' }>;
type TypeStep = Extract<QuickCheckStep, { kind: 'type' }>;
type OrderStep = Extract<QuickCheckStep, { kind: 'order' }>;

function chooseHtml(step: ChooseStep): string {
  const options = step.options
    .map(
      (opt, i) =>
        `<button type="button" class="qc__opt" data-option="${i}" data-text="${esc(opt)}" aria-pressed="false">${esc(opt)}</button>`,
    )
    .join('');
  return `<p class="qc__prompt">${esc(step.before)}<span class="qc__blank" data-upe-blank>&nbsp;</span>${esc(step.after)}</p>
      <div class="qc__options" role="group" aria-label="Options">${options}</div>
      <div class="alert qc__feedback" data-upe-feedback role="status" hidden><div><b data-upe-verdict></b></div></div>
      <div class="qc__actions"><button type="button" class="btn btn--sm" data-upe-check disabled>Check</button></div>`;
}

function typeHtml(step: TypeStep): string {
  const bank =
    step.bank.length > 0
      ? `<div class="qc__bank" role="group" aria-label="Word bank">${step.bank
          .map(
            (opt) =>
              `<button type="button" class="qc__opt qc__opt--chip" data-upe-bank>${esc(opt)}</button>`,
          )
          .join('')}</div>`
      : '';
  const prompt =
    step.variant === 'fill_blank'
      ? `<p class="qc__prompt">${esc(step.before)}<input class="qc__input qc__input--inline" data-upe-input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Missing word" />${esc(step.after)}</p>`
      : `<p class="qc__prompt">${esc(step.before)}</p><input class="qc__input" data-upe-input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Correct form" />`;
  const hint = step.hint ? `<p class="qc__hint">${esc(step.hint)}</p>` : '';
  return `${hint}${prompt}${bank}
      <div class="alert qc__feedback" data-upe-feedback role="status" hidden><div><b data-upe-verdict></b><p class="qc__note" data-upe-note hidden></p></div></div>
      <div class="qc__actions"><button type="button" class="btn btn--sm" data-upe-check disabled>Check</button></div>`;
}

function orderHtml(step: OrderStep): string {
  const chips = step.tokens
    .map(
      (token, slot) =>
        `<button type="button" class="qc__opt qc__opt--chip" data-order-chip="${slot}">${esc(token)}</button>`,
    )
    .join('');
  return `<p class="qc__hint">Tap the words in the order of the sentence.</p>
      <div class="qc__bank" role="group" aria-label="Words">${chips}</div>
      <p class="qc__prompt qc__build" data-upe-build aria-live="polite">&nbsp;</p>
      <div class="alert qc__feedback" data-upe-feedback role="status" hidden><div><b data-upe-verdict></b><p class="qc__note" data-upe-note hidden></p></div></div>
      <div class="qc__actions"><button type="button" class="btn btn--sm btn--ghost" data-upe-reset>Reset</button></div>`;
}

const KICKER: Record<
  QuickCheckStep['kind'],
  { text: string; tone: string } | null
> = {
  choose: { text: 'Choose the form', tone: 'tone-blue' },
  type: { text: '', tone: 'tone-pink' },
  order: { text: 'Put in order', tone: 'tone-brand' },
  recall: null,
  match: null,
};

function itemHtml(step: QuickCheckStep): string {
  if (step.kind === 'choose') {
    return `<p class="eyebrow qc__kicker ${KICKER.choose?.tone}">${KICKER.choose?.text}</p>${chooseHtml(step)}`;
  }
  if (step.kind === 'type') {
    const text =
      step.variant === 'find_error' ? 'Find the error' : 'Fill the blank';
    return `<p class="eyebrow qc__kicker ${KICKER.type?.tone}">${text}</p>${typeHtml(step)}`;
  }
  if (step.kind === 'order') {
    return `<p class="eyebrow qc__kicker ${KICKER.order?.tone}">${KICKER.order?.text}</p>${orderHtml(step)}`;
  }
  return '';
}

// Empty when the pool has nothing seeded yet (rollout is gradual, one usage
// point at a time) — the caller renders nothing in that case.
export function usagePointExercisesHtml(
  exercises: UsagePointExercise[],
): string {
  const steps = usagePointDrillSteps(exercises);
  if (steps.length === 0) {
    return '';
  }
  const items = steps
    .map((step) => {
      const answerIndex = step.kind === 'choose' ? step.answerIndex : '';
      const answer =
        step.kind === 'type'
          ? step.answer
          : step.kind === 'order'
            ? step.answerText
            : '';
      const order = step.kind === 'order' ? JSON.stringify(step.order) : '';
      return `<li class="upe__item card card--soft" data-upe-item data-upe-kind="${step.kind}" data-answer-index="${answerIndex}" data-answer="${esc(answer)}" data-order='${esc(order)}'>
        ${itemHtml(step)}
      </li>`;
    })
    .join('');
  return `<div class="upe" data-upe>
    <h3 class="upe__title">Practice</h3>
    <ul class="upe__list">${items}</ul>
  </div>`;
}
