import { sentenceAt } from './sentences';
import { speak, speechSupported, stopSpeaking } from './speech';

// Read-aloud for the reader: a play button at the end of every paragraph,
// heading and list item speaks that unit; `speakSentenceAt` speaks the sentence
// a label sits in (the popup's "Read the sentence"). Browsers without speech
// synthesis get no buttons.

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

export function initReaderListen(root: HTMLElement): void {
  if (!speechSupported()) {
    return;
  }
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

    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') {
        stopSpeaking();
        return;
      }
      setPlaying(true);
      speak(unitText(unit), () => setPlaying(false));
    });
  }
  window.addEventListener('pagehide', stopSpeaking);
}
