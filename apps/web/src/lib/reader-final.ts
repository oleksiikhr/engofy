// The reader's final screen (contrastive question(s), summary, practice CTA).
// Reaching it is what marks the post as read — by scrolling it into view, or
// by finishing study mode — so a post with no unfamiliar constructions (and
// so no question block) still counts.

export function initReaderFinal(final: HTMLElement, slugId: string): void {
  let reached = false;
  const reach = () => {
    if (reached) {
      return;
    }
    reached = true;
    const body = new FormData();
    body.set('slugId', slugId);
    // Best-effort, like the partial itself: a guest or a failure is silent.
    fetch('/partials/mark-read', {
      method: 'POST',
      body,
      keepalive: true,
    }).catch(() => {});
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          reach();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(final);
  } else {
    reach();
  }

  for (const question of final.querySelectorAll<HTMLElement>(
    '[data-contrast-q]',
  )) {
    const answer = Number(question.dataset.answerIndex);
    const result = question.querySelector<HTMLElement>('.final-q__result');
    for (const option of question.querySelectorAll<HTMLButtonElement>(
      '[data-option]',
    )) {
      option.addEventListener('click', () => {
        const picked = Number(option.dataset.option);
        const explanation = question.querySelector<HTMLElement>(
          `[data-explanation="${picked}"]`,
        );
        for (const other of question.querySelectorAll<HTMLElement>(
          '[data-explanation]',
        )) {
          other.hidden = other !== explanation;
        }
        option.classList.toggle('is-wrong', picked !== answer);
        option.classList.toggle('is-right', picked === answer);
        if (result) {
          result.textContent = picked === answer ? '✓ Correct' : '✗ Not quite';
          result.className = `final-q__result ${picked === answer ? 'is-ok' : 'is-bad'}`;
        }
      });
    }
  }

  final.addEventListener('reader:finish', ((
    event: CustomEvent<{ added: number }>,
  ) => {
    const added = final.querySelector<HTMLElement>('[data-added]');
    if (added && event.detail.added > 0) {
      added.textContent = ` You added ${event.detail.added} new word${event.detail.added === 1 ? '' : 's'} to your deck.`;
    }
    final.scrollIntoView({ block: 'start', behavior: 'smooth' });
    reach();
  }) as EventListener);
}
