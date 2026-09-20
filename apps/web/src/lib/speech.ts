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
  const done = stopActive;
  stopActive = null;
  done?.();
}

// Speaks `text` sentence by sentence: long utterances are cut off by some
// engines. `onDone` runs once when it ends, errors, or is replaced by another.
export function speak(text: string, onDone?: () => void): void {
  if (!speechSupported()) {
    return;
  }
  stopSpeaking();
  const parts = splitSentences(text).map((sentence) => sentence.text.trim());
  if (parts.length === 0) {
    onDone?.();
    return;
  }
  const id = session;
  stopActive = onDone ?? null;
  const finish = () => {
    if (session === id) {
      stopActive = null;
      onDone?.();
    }
  };
  parts.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.lang = LANG;
    if (index === parts.length - 1) {
      utterance.onend = finish;
    }
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}
