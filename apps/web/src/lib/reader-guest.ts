import { EXPLORED_EVENT, exploredCount } from './guest-progress';
import {
  LEVEL_SKIPPED,
  type LevelChoice,
  writeLevelChoice,
} from './reader-level';

// The guest part of the reader's info row: the level question and the
// explored-words count. The level is stored in a cookie (see
// lib/reader-level.ts) and the page reloads, so the server re-renders the
// highlights for it.

export function initReaderGuest(info: HTMLElement): void {
  const setRow = info.querySelector<HTMLElement>('[data-level-set]');
  const pickRow = info.querySelector<HTMLElement>('[data-level-pick]');
  const count = info.querySelector<HTMLElement>('[data-explored]');
  const number = count?.querySelector<HTMLElement>('b');

  const choose = (choice: LevelChoice) => {
    writeLevelChoice(choice);
    window.location.reload();
  };
  info.querySelector('[data-level-change]')?.addEventListener('click', () => {
    if (setRow && pickRow) {
      setRow.hidden = true;
      pickRow.hidden = false;
    }
  });
  info.querySelector('[data-level-skip]')?.addEventListener('click', () => {
    choose(LEVEL_SKIPPED);
  });
  for (const chip of info.querySelectorAll<HTMLElement>('[data-level]')) {
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
      document.documentElement.dataset.guestExplored = '';
      count.classList.add('is-ready');
    }
  };
  show(exploredCount());
  document.addEventListener(EXPLORED_EVENT, ((event: CustomEvent<number>) => {
    show(event.detail);
  }) as EventListener);
}
