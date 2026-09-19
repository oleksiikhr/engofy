// Quick check: one card, one question at a time (intro -> questions -> summary).
// Markup is server-rendered in the post page; this module only drives which
// screen is visible and grades "choose the form" answers client-side.

const RING_CIRCUMFERENCE = 302;

// Keys 1..9 pick the matching option.
const OPTION_KEYS = /^[1-9]$/;

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

  const show = (screen: HTMLElement) => {
    current = screen;
    for (const s of screens) {
      s.hidden = s !== screen;
    }
    screen.focus({ preventScroll: true });
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
    answered += 1;
    if (right) {
      correct += 1;
    }

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

    const feedback = q.querySelector<HTMLElement>('[data-qc-feedback]');
    if (feedback) {
      feedback.classList.toggle('tone-green', right);
      feedback.classList.toggle('tone-danger', !right);
      const verdict = feedback.querySelector<HTMLElement>('[data-qc-verdict]');
      if (verdict) {
        verdict.textContent = right ? 'Correct' : 'Not quite';
      }
      for (const note of feedback.querySelectorAll<HTMLElement>(
        '[data-explanation]',
      )) {
        const at = Number(note.dataset.explanation);
        note.hidden = !(at === picked || at === answer);
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
      check(current);
    } else if (target.closest('[data-qc-next]')) {
      advance();
    } else {
      const option = target.closest<HTMLElement>('[data-option]');
      if (option && questions.includes(current)) {
        select(current, Number(option.dataset.option));
      }
    }
  });

  // Bound to the card, not the document: keys only act while focus is inside
  // it (each screen change moves focus there).
  card.addEventListener('keydown', (event) => {
    if (current === summary || isTextField(event.target)) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      showSummary();
    } else if (!questions.includes(current)) {
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
