// The reader's final screen (Quick check card, summary, practice CTA). Study
// mode hands over here on Finish, which also marks the post read.
import { initQuickCheck } from './quick-check';

export function initReaderFinal(
  final: HTMLElement,
  markRead: (() => void) | null,
): void {
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
    markRead?.();
  }) as EventListener);
}
