// The CEFR badge in the post header opens a one-line note saying what the
// level means.

export function initLevelNote(badge: HTMLElement, note: HTMLElement): void {
  badge.addEventListener('click', () => {
    const open = note.hidden;
    note.hidden = !open;
    badge.setAttribute('aria-expanded', String(open));
  });
}
