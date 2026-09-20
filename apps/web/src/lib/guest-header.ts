import { NUDGE_DISMISSED_KEY, nudgeVariant } from './guest-boot';
import { DECK_EVENT, guestDeckCount } from './guest-deck';
import {
  dayKey,
  EXPLORED_EVENT,
  exploredCount,
  guestProgress,
} from './guest-progress';

// Guest header: the day streak and daily-goal ring, both derived from the
// words the guest explored (lib/guest-progress.ts), and the saved-cards count.
// Hidden until the guest has explored or saved something.

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
  const savedChip = wrap.querySelector<HTMLElement>('[data-guest-deck]');
  const savedNumber = savedChip?.querySelector<HTMLElement>('b');

  let reached: boolean | null = null;
  const render = () => {
    const { streak, today, goal } = guestProgress();
    const saved = guestDeckCount();
    wrap.hidden = streak === 0 && today === 0 && saved === 0;
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
    if (savedChip && savedNumber) {
      savedNumber.textContent = String(saved);
      savedChip.hidden = saved === 0;
      savedChip.title = `${saved} saved ${saved === 1 ? 'card' : 'cards'}`;
    }
  };

  render();
  document.addEventListener(EXPLORED_EVENT, render);
  document.addEventListener(DECK_EVENT, render);
}

function nudgeDismissed(): boolean {
  try {
    return localStorage.getItem(NUDGE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// One-time banner nudging a guest to log in once they have something to lose.
// The head boot script (lib/guest-boot.ts) sets `data-guest-nudge` on <html>
// before first paint, so the banner is in place from the first frame; this
// keeps the attribute and the counts in step afterwards. Closing it is
// remembered, so it never shows again.
export function initGuestNudge(nudge: HTMLElement): void {
  if (nudgeDismissed()) {
    return;
  }
  const root = document.documentElement;
  const counts = nudge.querySelectorAll<HTMLElement>('[data-nudge-count]');
  let dismissed = false;
  const render = () => {
    const saved = guestDeckCount();
    const explored = exploredCount();
    const variant = dismissed ? null : nudgeVariant(saved, explored);
    if (variant === null) {
      delete root.dataset.guestNudge;
      return;
    }
    for (const count of counts) {
      count.textContent = String(
        count.dataset.nudgeCount === 'saved' ? saved : explored,
      );
    }
    root.dataset.guestNudge = variant;
  };

  nudge
    .querySelector('[data-guest-nudge-close]')
    ?.addEventListener('click', () => {
      dismissed = true;
      render();
      try {
        localStorage.setItem(NUDGE_DISMISSED_KEY, '1');
      } catch {
        // Blocked storage — the nudge stays closed for this page only.
      }
    });

  render();
  document.addEventListener(EXPLORED_EVENT, render);
  document.addEventListener(DECK_EVENT, render);
}
