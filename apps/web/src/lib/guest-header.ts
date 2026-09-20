import { dayKey, EXPLORED_EVENT, guestProgress } from './guest-progress';

// Guest header: the day streak and daily-goal ring, both derived from the
// words the guest explored (lib/guest-progress.ts). Hidden until the guest has
// explored something.

const REACHED_CLASS = 'goal--reached';
const CELEBRATED_KEY = 'goal-celebrated';

// Plays the goal-reached animation once; the class is dropped when it ends so
// it can play again.
function celebrate(ring: HTMLElement): void {
  ring.classList.remove(REACHED_CLASS);
  // Reading the layout restarts the animation if the class was just removed.
  void ring.offsetWidth;
  ring.classList.add(REACHED_CLASS);
  ring.addEventListener(
    'animationend',
    () => ring.classList.remove(REACHED_CLASS),
    { once: true },
  );
}

// The signed-in ring is rendered by the server, so the goal can only be seen
// as reached on a page load. It is celebrated the first time that happens on a
// given day.
export function celebrateAccountGoal(): void {
  const ring = document.querySelector<HTMLElement>(
    '.site-header-right [data-goal-done]',
  );
  if (!ring) {
    return;
  }
  const done = Number(ring.dataset.goalDone);
  const target = Number(ring.dataset.goalTarget);
  if (!(done >= target) || target < 1) {
    return;
  }
  const today = dayKey(new Date());
  try {
    if (localStorage.getItem(CELEBRATED_KEY) === today) {
      return;
    }
    localStorage.setItem(CELEBRATED_KEY, today);
  } catch {
    // Blocked storage — the animation plays on this page load only.
  }
  celebrate(ring);
}

export function initGuestHeader(wrap: HTMLElement): void {
  const ring = wrap.querySelector<HTMLElement>('[data-goal-guest]');
  const arc = ring?.querySelector<SVGCircleElement>('.goal__arc');
  const streakChip = wrap.querySelector<HTMLElement>('[data-guest-streak]');
  const streakNumber = streakChip?.querySelector<HTMLElement>('b');

  let reached: boolean | null = null;
  const render = () => {
    const { streak, today, goal } = guestProgress();
    wrap.hidden = streak === 0 && today === 0;
    if (ring && arc) {
      const percent = Math.min(100, Math.round((today / goal) * 100));
      arc.setAttribute('stroke-dasharray', `${percent} 100`);
      ring.classList.toggle('goal--done', today >= goal);
      // Only crossing the goal while the page is open celebrates, not loading
      // a day that is already complete.
      if (reached === false && today >= goal) {
        celebrate(ring);
      }
      reached = today >= goal;
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
