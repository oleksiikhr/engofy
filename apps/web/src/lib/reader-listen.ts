import { sentenceAt } from './sentences';
import {
  pauseSpeaking,
  resumeSpeaking,
  speak,
  speakAll,
  speechSupported,
  stopSpeaking,
} from './speech';

// Read-aloud for the reader: a play button at the end of every paragraph,
// heading and list item speaks that unit; the toolbar's Listen reads every
// visible unit in order, with pause and stop; `speakSentenceAt` speaks the
// sentence a label sits in (the popup's "Read the sentence"). Browsers without
// speech synthesis get no buttons.

const UNIT_SELECTOR = '[data-block]:not(ul):not(ol), li[data-item]';
const PLAY_ICON =
  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';
const STOP_ICON =
  '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

function unitOf(el: Element): Element | null {
  return el.closest('li[data-item], [data-block]');
}

// Words are never split across nodes, so the unit's text is what is spoken.
function unitText(unit: Element): string {
  return unit.textContent ?? '';
}

export function speakSentenceAt(anchor: Element): void {
  const unit = unitOf(anchor);
  if (!unit) {
    return;
  }
  const range = document.createRange();
  range.setStart(unit, 0);
  range.setEnd(anchor, 0);
  const sentence = sentenceAt(unitText(unit), range.toString().length);
  if (sentence) {
    speak(sentence);
  }
}

// `controls` holds the toolbar's Listen / Pause / Stop buttons, server-rendered
// with their space reserved but invisible; they are revealed only when speech
// synthesis exists, so the toolbar never shifts.
export function initReaderListen(
  root: HTMLElement,
  controls: HTMLElement | null,
): void {
  if (!speechSupported()) {
    return;
  }
  const setPlayingBy = new Map<Element, (playing: boolean) => void>();
  for (const unit of root.querySelectorAll<HTMLElement>(UNIT_SELECTOR)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listen-btn';
    unit.append(button);

    const setPlaying = (playing: boolean) => {
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute(
        'aria-label',
        playing ? 'Stop reading' : 'Read this aloud',
      );
      button.innerHTML = playing ? STOP_ICON : PLAY_ICON;
      unit.classList.toggle('is-reading', playing);
    };
    setPlaying(false);
    setPlayingBy.set(unit, setPlaying);

    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') {
        stopSpeaking();
        return;
      }
      setPlaying(true);
      speak(unitText(unit), () => setPlaying(false));
    });
  }
  if (controls) {
    initListenAll(controls, setPlayingBy);
  }
  window.addEventListener('pagehide', stopSpeaking);
}

function initListenAll(
  controls: HTMLElement,
  setPlayingBy: Map<Element, (playing: boolean) => void>,
): void {
  const start = controls.querySelector<HTMLButtonElement>(
    '[data-listen="start"]',
  );
  const pause = controls.querySelector<HTMLButtonElement>(
    '[data-listen="pause"]',
  );
  const stop = controls.querySelector<HTMLButtonElement>(
    '[data-listen="stop"]',
  );
  const pauseLabel = pause?.querySelector('[data-label]');
  if (!start || !pause || !stop || !pauseLabel) {
    return;
  }

  let current: Element | null = null;
  let paused = false;
  const showRunning = (running: boolean) => {
    start.hidden = running;
    pause.hidden = !running;
    stop.hidden = !running;
  };
  const showPaused = (value: boolean) => {
    paused = value;
    pauseLabel.textContent = value ? 'Resume' : 'Pause';
  };

  start.addEventListener('click', () => {
    // Study mode hides all but one paragraph; only what is on screen is read.
    const units = [
      ...document.querySelectorAll<HTMLElement>(UNIT_SELECTOR),
    ].filter((unit) => setPlayingBy.has(unit) && unit.getClientRects().length);
    if (units.length === 0) {
      return;
    }
    showPaused(false);
    showRunning(true);
    speakAll(units.map(unitText), {
      onItem: (index) => {
        if (current) {
          setPlayingBy.get(current)?.(false);
        }
        current = units[index];
        setPlayingBy.get(current)?.(true);
        current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      onDone: () => {
        if (current) {
          setPlayingBy.get(current)?.(false);
        }
        current = null;
        showRunning(false);
      },
    });
  });
  pause.addEventListener('click', () => {
    if (paused) {
      resumeSpeaking();
    } else {
      pauseSpeaking();
    }
    showPaused(!paused);
  });
  stop.addEventListener('click', stopSpeaking);
  controls.dataset.ready = '';
}
