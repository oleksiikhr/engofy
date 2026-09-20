// The reader's progress bar: how far down the article body the viewport's
// bottom edge has travelled. Layout never moves — the bar is fixed and only
// its `--progress` custom property changes.

export function initReaderProgress(bar: HTMLElement, body: HTMLElement): void {
  let frame = 0;

  const update = () => {
    frame = 0;
    const rect = body.getBoundingClientRect();
    const travelled = window.innerHeight - rect.top;
    const ratio = Math.min(Math.max(travelled / rect.height, 0), 1);
    bar.style.setProperty('--progress', String(ratio));
    bar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  };
  const schedule = () => {
    if (!frame) {
      frame = requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}
