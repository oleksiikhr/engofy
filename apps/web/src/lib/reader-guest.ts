import { exploredCount } from './guest-progress';
import {
  LEVEL_SKIPPED,
  type LevelChoice,
  writeLevelChoice,
} from './reader-level';
import { EXPLORED_EVENT } from './reader-popup';

// The guest strip above the article: the level question and the explored-words
// count. The level is stored in a cookie (see lib/reader-level.ts) and the page
// reloads, so the server re-renders the highlights for it.

export function initReaderGuest(strip: HTMLElement): void {
  const setRow = strip.querySelector<HTMLElement>('[data-level-set]');
  const pickRow = strip.querySelector<HTMLElement>('[data-level-pick]');
  const count = strip.querySelector<HTMLElement>('[data-explored]');
  const number = count?.querySelector<HTMLElement>('b');

  const choose = (choice: LevelChoice) => {
    writeLevelChoice(choice);
    window.location.reload();
  };
  strip.querySelector('[data-level-change]')?.addEventListener('click', () => {
    if (setRow && pickRow) {
      setRow.hidden = true;
      pickRow.hidden = false;
    }
  });
  strip.querySelector('[data-level-skip]')?.addEventListener('click', () => {
    choose(LEVEL_SKIPPED);
  });
  for (const chip of strip.querySelectorAll<HTMLElement>('[data-level]')) {
    chip.addEventListener('click', () => {
      choose(chip.dataset.level as LevelChoice);
    });
  }

  const show = (value: number) => {
    if (count && number && value > 0) {
      number.textContent = String(value);
      const noun = count.querySelector('[data-explored-noun]');
      if (noun) {
        noun.textContent = value === 1 ? 'word' : 'words';
      }
      count.hidden = false;
    }
  };
  show(exploredCount());
  document.addEventListener(EXPLORED_EVENT, ((event: CustomEvent<number>) => {
    show(event.detail);
  }) as EventListener);
}
