import { speak } from './speech';

// Browser-side behaviour shared by every page that renders a practice card
// (/practice and the home page's daily-session step 2). Delegated on
// `document`, so it survives HTMX swapping the card in and out.

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function revealAnswer(revealBtn: HTMLElement): void {
  const answer =
    revealBtn.parentElement?.querySelector<HTMLElement>('.practice__answer');
  if (answer) {
    answer.hidden = false;
    revealBtn.hidden = true;
  }
}

document.addEventListener('click', (e) => {
  const target = e.target as Element | null;
  const revealBtn = target?.closest<HTMLElement>('.practice__reveal');
  if (revealBtn) {
    revealAnswer(revealBtn);
    return;
  }
  const speakBtn = target?.closest<HTMLElement>('.practice__speak');
  if (speakBtn) {
    if (speakBtn.dataset.speak) {
      speak(speakBtn.dataset.speak);
    }
  }
});

// Space = show answer; 1-4 = the Nth grade button (2 buttons on a New card,
// 4 otherwise). Grades only count once the answer is revealed, so a stray
// keypress can't grade a card unseen.
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) {
    return;
  }
  const card = document.querySelector<HTMLElement>('.practice__card');
  if (!card) {
    return;
  }
  const revealBtn = card.querySelector<HTMLElement>('.practice__reveal');
  const awaitingReveal = revealBtn !== null && !revealBtn.hidden;

  if (e.key === ' ') {
    if (awaitingReveal) {
      e.preventDefault();
      revealAnswer(revealBtn);
    }
    return;
  }
  if (/^[1-4]$/.test(e.key) && !awaitingReveal) {
    const grades = card.querySelectorAll<HTMLElement>('.practice__grade');
    grades[Number(e.key) - 1]?.click();
  }
});
