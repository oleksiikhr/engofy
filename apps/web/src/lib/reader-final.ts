// The reader's final screen (Quick check card, summary, practice CTA). Study
// mode hands over here on Finish, which also marks the post read; when study
// mode already asked questions, the card jumps to the summary with that score.
import { initQuickCheck } from './quick-check';

export interface FinishDetail {
  added: number;
  answered: number;
  correct: number;
  cleared: number;
}

export function initReaderFinal(
  final: HTMLElement,
  markRead: (() => void) | null,
): void {
  const card = final.querySelector<HTMLElement>('[data-qc]');
  const quickCheck = card ? initQuickCheck(card) : null;

  final.addEventListener('reader:finish', ((
    event: CustomEvent<FinishDetail>,
  ) => {
    const added = final.querySelector<HTMLElement>('[data-added]');
    if (added && event.detail.added > 0) {
      added.textContent = ` You added ${event.detail.added} new word${event.detail.added === 1 ? '' : 's'} to your deck.`;
    }
    if (event.detail.answered > 0) {
      quickCheck?.finishWith(event.detail);
    }
    final.scrollIntoView({ block: 'start', behavior: 'smooth' });
    markRead?.();
  }) as EventListener);
}
