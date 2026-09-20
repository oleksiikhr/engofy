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

const NUDGE_DISMISSED_KEY = 'guest-nudge-dismissed';
// Saved cards or explored words at which the sign-up nudge appears.
export const NUDGE_SAVED_AT = 3;
export const NUDGE_EXPLORED_AT = 10;

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

// What the nudge says for the guest's progress, or null while it isn't due:
// three saved cards, or ten explored words.
export function nudgeMessage(saved: number, explored: number): string | null {
  if (saved >= NUDGE_SAVED_AT) {
    return `You've saved ${saved} ${saved === 1 ? 'card' : 'cards'}. Log in so they don't get lost.`;
  }
  if (explored >= NUDGE_EXPLORED_AT) {
    return `You've explored ${explored} words. Log in to keep your cards and progress.`;
  }
  return null;
}

// One-time banner nudging a guest to log in once they have something to lose.
// Closing it is remembered, so it never shows again.
export function initGuestNudge(nudge: HTMLElement): void {
  if (nudgeDismissed()) {
    return;
  }
  const text = nudge.querySelector<HTMLElement>('[data-guest-nudge-text]');
  let dismissed = false;
  const render = () => {
    const message = nudgeMessage(guestDeckCount(), exploredCount());
    if (dismissed || !text || message === null) {
      return;
    }
    text.textContent = message;
    nudge.hidden = false;
  };

  nudge
    .querySelector('[data-guest-nudge-close]')
    ?.addEventListener('click', () => {
      dismissed = true;
      nudge.hidden = true;
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
