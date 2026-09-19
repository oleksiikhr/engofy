// The reader's final screen (Quick check card, summary, practice CTA).
// Reaching it is what marks the post as read — by scrolling it into view, or
// by finishing study mode — so a post with no unfamiliar constructions (and
// so no questions) still counts.
import { initQuickCheck } from './quick-check';

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

  const card = final.querySelector<HTMLElement>('[data-qc]');
  if (card) {
    initQuickCheck(card);
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
