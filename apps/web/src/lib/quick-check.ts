// Quick check: one card, one question at a time (intro -> questions -> summary).
// Markup is server-rendered (QuickCheck.astro); this module drives which screen
// is visible, grades "choose the form", "match pairs", "type the answer" and
// "put in order" client-side, and sends "recall a word" ratings to the review
// endpoint.

const RING_CIRCUMFERENCE = 302;

// Keys 1..9 pick the matching option.
const OPTION_KEYS = /^[1-9]$/;
// Keys 1..4 rate a recalled word: Again, Hard, Good, Easy.
const RATINGS = ['again', 'hard', 'good', 'easy'];
// How long a wrong match pair stays marked before it clears.
const MISMATCH_MS = 700;

const normalize = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function initQuickCheck(card: HTMLElement): void {
  const screens = Array.from(
    card.querySelectorAll<HTMLElement>('[data-qc-screen]'),
  );
  const questions = screens.filter((s) => s.dataset.qcScreen === 'question');
  const summary = screens.find((s) => s.dataset.qcScreen === 'summary');
  const intro = screens.find((s) => s.dataset.qcScreen === 'intro');
  if (!summary || !intro || questions.length === 0) {
    return;
  }

  let current: HTMLElement = intro;
  let answered = 0;
  let correct = 0;
  // Recalled cards rated above Again: they leave today's due count.
  let cleared = 0;

  const kindOf = (q: HTMLElement) => q.dataset.qcKind;
  const record = (right: boolean) => {
    answered += 1;
    if (right) {
      correct += 1;
    }
  };

  // Shuffle each match screen's meanings so rows don't line up with the words.
  for (const q of questions.filter((s) => kindOf(s) === 'match')) {
    const column = q.querySelector<HTMLElement>('[data-match-meanings]');
    const items = Array.from(column?.children ?? []);
    if (!column || items.length < 2) {
      continue;
    }
    let shuffled = items;
    while (shuffled.every((item, i) => item === items[i])) {
      shuffled = [...items].sort(() => Math.random() - 0.5);
    }
    column.replaceChildren(...shuffled);
  }

  const show = (screen: HTMLElement) => {
    current = screen;
    for (const s of screens) {
      s.hidden = s !== screen;
    }
    const input = screen.querySelector<HTMLInputElement>('[data-qc-input]');
    const typing = input && !screen.querySelector('[data-qc-bank]');
    (typing ? input : screen).focus({ preventScroll: true });
  };

  const showSummary = () => {
    const ring = summary.querySelector<HTMLElement>('[data-qc-ring]');
    const title = summary.querySelector<HTMLElement>('[data-qc-title]');
    if (answered > 0 && ring) {
      const bar = ring.querySelector<SVGCircleElement>('[data-qc-ring-bar]');
      const label = ring.querySelector<SVGTextElement>('[data-qc-ring-text]');
      const dash = Math.round((RING_CIRCUMFERENCE * correct) / answered);
      bar?.setAttribute('stroke-dasharray', `${dash} ${RING_CIRCUMFERENCE}`);
      // A zero-length round-capped stroke still paints a dot.
      bar?.setAttribute('visibility', correct === 0 ? 'hidden' : 'visible');
      if (label) {
        label.textContent = `${correct}/${answered}`;
      }
      ring
        .querySelector('svg')
        ?.setAttribute('aria-label', `${correct} of ${answered} correct`);
      ring.hidden = false;
    }
    const dueTile = summary.querySelector<HTMLElement>('[data-qc-due]');
    if (dueTile && cleared > 0) {
      const left = Math.max(0, Number(dueTile.dataset.qcDue) - cleared);
      dueTile.textContent = String(left);
      const practice =
        summary.querySelector<HTMLAnchorElement>('[data-qc-practice]');
      if (practice) {
        practice.textContent = `Practice ${left} card${left === 1 ? '' : 's'} from this text`;
        practice.hidden = left === 0;
      }
    }
    if (title) {
      title.textContent =
        answered === 0
          ? 'You finished this text.'
          : correct * 2 >= answered
            ? 'Nice work.'
            : 'Keep at it.';
    }
    show(summary);
  };

  const options = (q: HTMLElement) =>
    Array.from(q.querySelectorAll<HTMLButtonElement>('[data-option]'));
  const isChecked = (q: HTMLElement) => q.dataset.checked === 'true';

  // The verdict and the Continue button, shared by every graded kind.
  const showFeedback = (q: HTMLElement, right: boolean) => {
    const feedback = q.querySelector<HTMLElement>('[data-qc-feedback]');
    if (feedback) {
      feedback.classList.toggle('tone-green', right);
      feedback.classList.toggle('tone-danger', !right);
      const verdict = feedback.querySelector<HTMLElement>('[data-qc-verdict]');
      if (verdict) {
        verdict.textContent = right ? 'Correct' : 'Not quite';
      }
      feedback.hidden = false;
    }
    const checkButton = q.querySelector<HTMLElement>('[data-qc-check]');
    const next = q.querySelector<HTMLElement>('[data-qc-next]');
    if (checkButton) {
      checkButton.hidden = true;
    }
    if (next) {
      next.hidden = false;
      next.focus({ preventScroll: true });
    }
  };

  // After a wrong typed or ordered answer, say what it should have been.
  const showAnswer = (q: HTMLElement, right: boolean) => {
    const note = q.querySelector<HTMLElement>('[data-qc-note]');
    if (note && !right) {
      note.textContent = `Answer: ${q.dataset.answer ?? ''}`;
      note.hidden = false;
    }
  };

  const select = (q: HTMLElement, index: number) => {
    if (isChecked(q)) {
      return;
    }
    const all = options(q);
    const picked = all[index];
    if (!picked) {
      return;
    }
    q.dataset.picked = String(index);
    for (const option of all) {
      const on = option === picked;
      option.setAttribute('aria-pressed', String(on));
      option.classList.toggle('is-selected', on);
    }
    const blank = q.querySelector<HTMLElement>('[data-qc-blank]');
    if (blank) {
      blank.textContent = picked.dataset.text ?? '';
    }
    const check = q.querySelector<HTMLButtonElement>('[data-qc-check]');
    if (check) {
      check.disabled = false;
    }
  };

  const check = (q: HTMLElement) => {
    if (isChecked(q) || q.dataset.picked === undefined) {
      return;
    }
    const picked = Number(q.dataset.picked);
    const answer = Number(q.dataset.answerIndex);
    const right = picked === answer;
    q.dataset.checked = 'true';
    record(right);

    const all = options(q);
    all.forEach((option, i) => {
      option.disabled = true;
      option.classList.remove('is-selected');
      option.classList.toggle('is-right', i === answer);
      option.classList.toggle('is-wrong', i === picked && !right);
      option.classList.toggle('is-faded', i !== answer && i !== picked);
    });
    const blank = q.querySelector<HTMLElement>('[data-qc-blank]');
    if (blank) {
      blank.textContent = all[answer]?.dataset.text ?? '';
    }

    for (const note of q.querySelectorAll<HTMLElement>('[data-explanation]')) {
      const at = Number(note.dataset.explanation);
      note.hidden = !(at === picked || at === answer);
    }
    showFeedback(q, right);
  };

  const typedInput = (q: HTMLElement) =>
    q.querySelector<HTMLInputElement>('[data-qc-input]');

  const checkTyped = (q: HTMLElement) => {
    const input = typedInput(q);
    if (!input || isChecked(q) || !normalize(input.value)) {
      return;
    }
    const right = normalize(input.value) === normalize(q.dataset.answer);
    q.dataset.checked = 'true';
    record(right);
    input.readOnly = true;
    input.classList.add(right ? 'is-right' : 'is-wrong');
    for (const chip of q.querySelectorAll<HTMLButtonElement>(
      '[data-qc-bank]',
    )) {
      chip.disabled = true;
    }
    showAnswer(q, right);
    showFeedback(q, right);
  };

  const fillFromBank = (q: HTMLElement, chip: HTMLElement) => {
    const input = typedInput(q);
    const checkButton = q.querySelector<HTMLButtonElement>('[data-qc-check]');
    if (!input || isChecked(q)) {
      return;
    }
    input.value = chip.textContent?.trim() ?? '';
    if (checkButton) {
      checkButton.disabled = false;
    }
  };

  // Chips already tapped on each order screen, in tap order.
  const picks = new Map<HTMLElement, HTMLButtonElement[]>();

  const renderBuild = (q: HTMLElement) => {
    const build = q.querySelector<HTMLElement>('[data-qc-build]');
    const words = (picks.get(q) ?? []).map((c) => c.textContent?.trim());
    if (build) {
      build.textContent = words.length > 0 ? words.join(' ') : '\u00a0';
    }
  };

  const pickChip = (q: HTMLElement, chip: HTMLButtonElement) => {
    if (isChecked(q) || chip.disabled) {
      return;
    }
    const chosen = [...(picks.get(q) ?? []), chip];
    picks.set(q, chosen);
    chip.disabled = true;
    renderBuild(q);
    const order: number[] = JSON.parse(q.dataset.order ?? '[]');
    if (chosen.length < order.length) {
      return;
    }
    const right = chosen.every(
      (c, i) => order[Number(c.dataset.orderChip)] === i,
    );
    q.dataset.checked = 'true';
    record(right);
    q.querySelector<HTMLElement>('[data-qc-reset]')?.setAttribute('hidden', '');
    showAnswer(q, right);
    showFeedback(q, right);
  };

  const resetOrder = (q: HTMLElement) => {
    if (isChecked(q)) {
      return;
    }
    picks.delete(q);
    for (const chip of q.querySelectorAll<HTMLButtonElement>(
      '[data-order-chip]',
    )) {
      chip.disabled = false;
    }
    renderBuild(q);
  };

  const reveal = (q: HTMLElement) => {
    const answer = q.querySelector<HTMLElement>('[data-qc-answer]');
    if (!answer?.hidden) {
      return;
    }
    answer.hidden = false;
    q.querySelector<HTMLElement>('[data-qc-reveal]')?.setAttribute(
      'hidden',
      '',
    );
    const rate = q.querySelector<HTMLElement>('[data-qc-rate]');
    if (rate) {
      rate.hidden = false;
    }
    // The Show answer button just left the page; keep keys working.
    q.focus({ preventScroll: true });
  };

  const rate = (q: HTMLElement, rating: string) => {
    const answer = q.querySelector<HTMLElement>('[data-qc-answer]');
    if (q.dataset.checked === 'true' || !answer || answer.hidden) {
      return;
    }
    q.dataset.checked = 'true';
    const body = new FormData();
    body.set('cardId', q.dataset.cardId ?? '');
    body.set('rating', rating);
    // Best-effort, like mark-read: a failure must not block the quiz.
    fetch('/partials/card-review', {
      method: 'POST',
      body,
      keepalive: true,
    }).catch(() => {});
    record(rating !== 'again');
    if (rating !== 'again') {
      cleared += 1;
    }
    advance();
  };

  const pickPair = (q: HTMLElement, button: HTMLButtonElement) => {
    if (button.disabled) {
      return;
    }
    const side = 'matchTerm' in button.dataset ? 'matchTerm' : 'matchMeaning';
    const other = side === 'matchTerm' ? 'matchMeaning' : 'matchTerm';
    const selected = q.querySelector<HTMLButtonElement>('.is-selected');

    if (selected && other in selected.dataset) {
      const right = selected.dataset[other] === button.dataset[side];
      const pair = [selected, button];
      selected.classList.remove('is-selected');
      selected.setAttribute('aria-pressed', 'false');
      if (right) {
        for (const item of pair) {
          item.disabled = true;
          item.classList.add('is-right');
        }
        const total = Number(
          q.querySelector<HTMLElement>('[data-qc-match]')?.dataset.qcMatch,
        );
        const matched = q.querySelectorAll('.qc__opt.is-right').length / 2;
        const count = q.querySelector('[data-qc-match-count]');
        if (count) {
          count.textContent = `${matched} of ${total}`;
        }
        if (matched === total) {
          q.dataset.checked = 'true';
          record(q.dataset.mistakes === undefined);
          const next = q.querySelector<HTMLElement>('[data-qc-next]');
          if (next) {
            next.hidden = false;
            next.focus({ preventScroll: true });
          }
        }
      } else {
        q.dataset.mistakes = String(Number(q.dataset.mistakes ?? 0) + 1);
        for (const item of pair) {
          item.classList.add('is-wrong');
        }
        setTimeout(() => {
          for (const item of pair) {
            item.classList.remove('is-wrong');
          }
        }, MISMATCH_MS);
      }
      return;
    }

    // First pick, or a switch between two on the same side.
    if (selected) {
      selected.classList.remove('is-selected');
      selected.setAttribute('aria-pressed', 'false');
    }
    button.classList.add('is-selected');
    button.setAttribute('aria-pressed', 'true');
  };

  const advance = () => {
    const at = questions.indexOf(current);
    if (at === -1) {
      return;
    }
    if (at + 1 < questions.length) {
      show(questions[at + 1]);
    } else {
      showSummary();
    }
  };

  card.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('[data-qc-start]')) {
      show(questions[0]);
    } else if (target.closest('[data-qc-skip]')) {
      showSummary();
    } else if (target.closest('[data-qc-check]')) {
      if (kindOf(current) === 'type') {
        checkTyped(current);
      } else {
        check(current);
      }
    } else if (target.closest('[data-qc-reset]')) {
      resetOrder(current);
    } else if (target.closest('[data-qc-next]')) {
      advance();
    } else if (target.closest('[data-qc-reveal]')) {
      reveal(current);
    } else {
      const rating = target.closest<HTMLElement>('[data-rating]');
      const pair = target.closest<HTMLButtonElement>(
        '[data-match-term], [data-match-meaning]',
      );
      const option = target.closest<HTMLElement>('[data-option]');
      const bank = target.closest<HTMLElement>('[data-qc-bank]');
      const chip = target.closest<HTMLButtonElement>('[data-order-chip]');
      if (bank && questions.includes(current)) {
        fillFromBank(current, bank);
      } else if (chip && questions.includes(current)) {
        pickChip(current, chip);
      } else if (rating && questions.includes(current)) {
        rate(current, rating.dataset.rating ?? '');
      } else if (pair && questions.includes(current)) {
        pickPair(current, pair);
      } else if (option && questions.includes(current)) {
        select(current, Number(option.dataset.option));
      }
    }
  });

  card.addEventListener('input', (event) => {
    const input = event.target as HTMLElement;
    const checkButton =
      current.querySelector<HTMLButtonElement>('[data-qc-check]');
    if (
      input instanceof HTMLInputElement &&
      checkButton &&
      !isChecked(current)
    ) {
      checkButton.disabled = !normalize(input.value);
    }
  });

  // Bound to the card, not the document: keys only act while focus is inside
  // it (each screen change moves focus there).
  card.addEventListener('keydown', (event) => {
    if (current === summary) {
      return;
    }
    if (isTextField(event.target)) {
      if (event.key === 'Enter' && kindOf(current) === 'type') {
        event.preventDefault();
        if (isChecked(current)) {
          advance();
        } else {
          checkTyped(current);
        }
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      showSummary();
    } else if (!questions.includes(current)) {
      return;
    } else if (kindOf(current) === 'recall') {
      const revealed =
        current.querySelector<HTMLElement>('[data-qc-answer]')?.hidden ===
        false;
      if (!revealed) {
        // A focused button already handles its own Enter/Space.
        if (
          (event.key === ' ' || event.key === 'Enter') &&
          event.target === current
        ) {
          event.preventDefault();
          reveal(current);
        }
      } else if (RATINGS[Number(event.key) - 1]) {
        rate(current, RATINGS[Number(event.key) - 1]);
      }
    } else if (kindOf(current) !== 'choose') {
      return;
    } else if (OPTION_KEYS.test(event.key)) {
      select(current, Number(event.key) - 1);
    } else if (event.key === 'Enter') {
      // On a real button (Check, Continue, Skip) Enter already clicks it; on an
      // option or the bare screen it confirms the pick.
      const onOption = (event.target as Element).closest('[data-option]');
      if (event.target === current || onOption) {
        event.preventDefault();
        if (isChecked(current)) {
          advance();
        } else {
          check(current);
        }
      }
    }
  });
}
