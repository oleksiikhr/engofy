import { splitSentences } from './sentences';

// Read-aloud through the browser's Web Speech API — no audio asset, no server.
// One thing is spoken at a time: starting a new text stops the previous one and
// tells its owner (`onDone`) so the play button flips back.

const LANG = 'en-US';

let stopActive: (() => void) | null = null;
let session = 0;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (!speechSupported()) {
    return;
  }
  session++;
  window.speechSynthesis.cancel();
  // Some engines stay paused after a cancel and swallow the next utterance.
  window.speechSynthesis.resume();
  const done = stopActive;
  stopActive = null;
  done?.();
}

export function pauseSpeaking(): void {
  if (speechSupported()) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeaking(): void {
  if (speechSupported()) {
    window.speechSynthesis.resume();
  }
}

// Queues `text` sentence by sentence: long utterances are cut off by some
// engines. `onEnd` runs after the last one; `onError` if one fails.
function queue(text: string, onEnd: () => void, onError: () => void): void {
  const parts = splitSentences(text).map((sentence) => sentence.text.trim());
  if (parts.length === 0) {
    onEnd();
    return;
  }
  parts.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.lang = LANG;
    if (index === parts.length - 1) {
      utterance.onend = onEnd;
    }
    utterance.onerror = onError;
    window.speechSynthesis.speak(utterance);
  });
}

// Speaks `text`. `onDone` runs once when it ends, errors, or is replaced by
// another.
export function speak(text: string, onDone?: () => void): void {
  speakAll([text], { onDone });
}

// Speaks `texts` one after another. `onItem(index)` runs as each starts;
// `onDone` runs once when the last one ends, one errors, or the whole run is
// stopped or replaced by another.
export function speakAll(
  texts: string[],
  hooks: { onItem?: (index: number) => void; onDone?: () => void },
): void {
  if (!speechSupported()) {
    return;
  }
  stopSpeaking();
  const id = session;
  stopActive = hooks.onDone ?? null;
  let ended = false;
  const finish = () => {
    if (session === id && !ended) {
      ended = true;
      stopActive = null;
      hooks.onDone?.();
    }
  };
  const play = (index: number) => {
    if (session !== id) {
      return;
    }
    if (index >= texts.length) {
      finish();
      return;
    }
    hooks.onItem?.(index);
    queue(texts[index], () => play(index + 1), finish);
  };
  play(0);
}
