import { EXPLORED_EVENT, guestProgress } from './guest-progress';

// Guest header: the day streak and daily-goal ring, both derived from the
// words the guest explored (lib/guest-progress.ts). Hidden until the guest has
// explored something.

export function initGuestHeader(wrap: HTMLElement): void {
  const ring = wrap.querySelector<HTMLElement>('[data-goal-guest]');
  const arc = ring?.querySelector<SVGCircleElement>('.goal__arc');
  const streakChip = wrap.querySelector<HTMLElement>('[data-guest-streak]');
  const streakNumber = streakChip?.querySelector<HTMLElement>('b');

  const render = () => {
    const { streak, today, goal } = guestProgress();
    wrap.hidden = streak === 0 && today === 0;
    if (ring && arc) {
      const percent = Math.min(100, Math.round((today / goal) * 100));
      arc.setAttribute('stroke-dasharray', `${percent} 100`);
      ring.classList.toggle('goal--done', today >= goal);
      const label = `${today} of ${goal} words today`;
      ring.title = label;
      ring.setAttribute('aria-label', label);
    }
    if (streakChip && streakNumber) {
      streakNumber.textContent = String(streak);
      streakChip.hidden = streak === 0;
      streakChip.title = `${streak}-day streak`;
    }
  };

  render();
  document.addEventListener(EXPLORED_EVENT, render);
}
