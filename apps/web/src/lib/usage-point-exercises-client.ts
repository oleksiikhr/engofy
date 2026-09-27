// Drives the `/grammar/{slug}` exercises section (`usage-point-
// -exercises.ts`'s markup). Each `[data-upe-item]` is checked independently —
// there is no session to advance through, unlike the reader's Quick check
// (`quick-check.ts`), so this only wires Check/reveal per item.

const normalize = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

function options(item: HTMLElement): HTMLButtonElement[] {
  return Array.from(item.querySelectorAll<HTMLButtonElement>('[data-option]'));
}

function isChecked(item: HTMLElement): boolean {
  return item.dataset.checked === 'true';
}

function showFeedback(item: HTMLElement, right: boolean): void {
  const feedback = item.querySelector<HTMLElement>('[data-upe-feedback]');
  if (feedback) {
    feedback.classList.toggle('tone-green', right);
    feedback.classList.toggle('tone-danger', !right);
    const verdict = feedback.querySelector<HTMLElement>('[data-upe-verdict]');
    if (verdict) {
      verdict.textContent = right ? 'Correct' : 'Not quite';
    }
    feedback.hidden = false;
  }
  item
    .querySelector<HTMLElement>('[data-upe-check]')
    ?.setAttribute('hidden', '');
}

function showAnswer(item: HTMLElement, right: boolean): void {
  const note = item.querySelector<HTMLElement>('[data-upe-note]');
  if (note && !right) {
    note.textContent = `Answer: ${item.dataset.answer ?? ''}`;
    note.hidden = false;
  }
}

function select(item: HTMLElement, index: number): void {
  if (isChecked(item)) {
    return;
  }
  const all = options(item);
  const picked = all[index];
  if (!picked) {
    return;
  }
  item.dataset.picked = String(index);
  for (const option of all) {
    const on = option === picked;
    option.setAttribute('aria-pressed', String(on));
    option.classList.toggle('is-selected', on);
  }
  const blank = item.querySelector<HTMLElement>('[data-upe-blank]');
  if (blank) {
    blank.textContent = picked.dataset.text ?? '';
  }
  const check = item.querySelector<HTMLButtonElement>('[data-upe-check]');
  if (check) {
    check.disabled = false;
  }
}

function checkChoice(item: HTMLElement): void {
  if (isChecked(item) || item.dataset.picked === undefined) {
    return;
  }
  const picked = Number(item.dataset.picked);
  const answer = Number(item.dataset.answerIndex);
  const right = picked === answer;
  item.dataset.checked = 'true';
  const all = options(item);
  all.forEach((option, i) => {
    option.disabled = true;
    option.classList.remove('is-selected');
    option.classList.toggle('is-right', i === answer);
    option.classList.toggle('is-wrong', i === picked && !right);
    option.classList.toggle('is-faded', i !== answer && i !== picked);
  });
  const blank = item.querySelector<HTMLElement>('[data-upe-blank]');
  if (blank) {
    blank.textContent = all[answer]?.dataset.text ?? '';
  }
  showFeedback(item, right);
}

function typedInput(item: HTMLElement): HTMLInputElement | null {
  return item.querySelector<HTMLInputElement>('[data-upe-input]');
}

function checkTyped(item: HTMLElement): void {
  const input = typedInput(item);
  if (!input || isChecked(item) || !normalize(input.value)) {
    return;
  }
  const right = normalize(input.value) === normalize(item.dataset.answer);
  item.dataset.checked = 'true';
  input.readOnly = true;
  input.classList.add(right ? 'is-right' : 'is-wrong');
  for (const chip of item.querySelectorAll<HTMLButtonElement>(
    '[data-upe-bank]',
  )) {
    chip.disabled = true;
  }
  showAnswer(item, right);
  showFeedback(item, right);
}

function fillFromBank(item: HTMLElement, chip: HTMLElement): void {
  const input = typedInput(item);
  const checkButton = item.querySelector<HTMLButtonElement>('[data-upe-check]');
  if (!input || isChecked(item)) {
    return;
  }
  input.value = chip.textContent?.trim() ?? '';
  if (checkButton) {
    checkButton.disabled = false;
  }
}

// Chips already tapped on each order item, in tap order.
const picks = new Map<HTMLElement, HTMLButtonElement[]>();

function renderBuild(item: HTMLElement): void {
  const build = item.querySelector<HTMLElement>('[data-upe-build]');
  const words = (picks.get(item) ?? []).map((c) => c.textContent?.trim());
  if (build) {
    build.textContent = words.length > 0 ? words.join(' ') : ' ';
  }
}

function pickChip(item: HTMLElement, chip: HTMLButtonElement): void {
  if (isChecked(item) || chip.disabled) {
    return;
  }
  const chosen = [...(picks.get(item) ?? []), chip];
  picks.set(item, chosen);
  chip.disabled = true;
  renderBuild(item);
  const order: number[] = JSON.parse(item.dataset.order || '[]');
  if (chosen.length < order.length) {
    return;
  }
  const right = chosen.every(
    (c, i) => order[Number(c.dataset.orderChip)] === i,
  );
  item.dataset.checked = 'true';
  item
    .querySelector<HTMLElement>('[data-upe-reset]')
    ?.setAttribute('hidden', '');
  showAnswer(item, right);
  showFeedback(item, right);
}

function resetOrder(item: HTMLElement): void {
  if (isChecked(item)) {
    return;
  }
  picks.delete(item);
  for (const chip of item.querySelectorAll<HTMLButtonElement>(
    '[data-order-chip]',
  )) {
    chip.disabled = false;
  }
  renderBuild(item);
}

// Wires every `[data-upe]` exercises section under `root` — the grammar
// detail page renders one per usage point that has a seeded pool.
export function initUsagePointExercises(root: ParentNode): void {
  for (const section of root.querySelectorAll<HTMLElement>('[data-upe]')) {
    section.addEventListener('click', (event) => {
      const target = event.target as Element;
      const item = target.closest<HTMLElement>('[data-upe-item]');
      if (!item) {
        return;
      }
      if (target.closest('[data-upe-check]')) {
        item.dataset.upeKind === 'type' ? checkTyped(item) : checkChoice(item);
      } else if (target.closest('[data-upe-reset]')) {
        resetOrder(item);
      } else {
        const bank = target.closest<HTMLElement>('[data-upe-bank]');
        const chip = target.closest<HTMLButtonElement>('[data-order-chip]');
        const option = target.closest<HTMLElement>('[data-option]');
        if (bank) {
          fillFromBank(item, bank);
        } else if (chip) {
          pickChip(item, chip);
        } else if (option) {
          select(item, Number(option.dataset.option));
        }
      }
    });
    section.addEventListener('input', (event) => {
      const input = event.target;
      const item = (input as HTMLElement).closest<HTMLElement>(
        '[data-upe-item]',
      );
      const checkButton =
        item?.querySelector<HTMLButtonElement>('[data-upe-check]');
      if (
        input instanceof HTMLInputElement &&
        item &&
        checkButton &&
        !isChecked(item)
      ) {
        checkButton.disabled = !normalize(input.value);
      }
    });
  }
}
