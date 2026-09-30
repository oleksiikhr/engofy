// Progressive enhancement for the sticky section checklist on
// /grammar/[slug] (GrammarSectionProgress): keeps the track+fill bar and
// each checklist item's done state in sync with the accordion <details>
// sections, and opens+scrolls a closed section when its checklist item is
// clicked. The initial fill/done state is server-rendered from the same
// `open` props the sections themselves use, so this never has to run before
// first paint.
export function initGrammarSectionProgress(nav: HTMLElement): void {
  const fill = nav.querySelector<HTMLElement>('[data-gp-progress-fill]');
  const items = Array.from(
    nav.querySelectorAll<HTMLAnchorElement>('[data-gp-progress-item]'),
  );

  const count = nav.querySelector<HTMLElement>('[data-gp-progress-count]');
  const current = nav.querySelector<HTMLElement>('[data-gp-progress-current]');
  const more = nav.querySelector<HTMLDetailsElement>('[data-gp-progress-more]');

  const sync = () => {
    if (items.length === 0) {
      return;
    }
    const done = items.filter((item) => item.dataset.done === 'true').length;
    if (fill) {
      fill.style.width = `${Math.round((done / items.length) * 100)}%`;
    }
    if (count) {
      count.textContent = `${done}/${items.length}`;
    }
  };

  // The bar names the section being read: the last one whose top has passed
  // the sticky bar. Text only, on a fixed-height single line.
  const sections = items.flatMap((item) => {
    const el = document.getElementById(
      `gp-section-${item.dataset.gpProgressItem}`,
    );
    return el ? [{ el, title: item.textContent?.trim() ?? '' }] : [];
  });
  const syncCurrent = () => {
    if (!current || sections.length === 0) {
      return;
    }
    const line = nav.getBoundingClientRect().bottom + 8;
    let active = sections[0];
    for (const section of sections) {
      if (section.el.getBoundingClientRect().top <= line) {
        active = section;
      }
    }
    current.textContent = active.title;
  };
  window.addEventListener('scroll', syncCurrent, { passive: true });
  syncCurrent();

  for (const item of items) {
    const id = item.dataset.gpProgressItem;
    const target = id && document.getElementById(`gp-section-${id}`);
    if (!target) {
      continue;
    }

    if (target instanceof HTMLDetailsElement) {
      target.addEventListener('toggle', () => {
        item.dataset.done = target.open ? 'true' : 'false';
        sync();
      });
    }

    item.addEventListener('click', (event) => {
      event.preventDefault();
      if (more) {
        more.open = false;
      }
      if (target instanceof HTMLDetailsElement && !target.open) {
        target.open = true;
        item.dataset.done = 'true';
        sync();
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// A `#usage-point-{egpIndex}` deep link (the Reader popup's "Practice" link)
// can point into a closed section. Open every <details> around the target so
// it's visible, then scroll to it; the sections' own `toggle` listeners
// (above) keep the checklist in step.
export function openHashTarget(): void {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (!target) {
    return;
  }
  let opened = false;
  for (
    let details = target.closest('details');
    details;
    details = details.parentElement?.closest('details') ?? null
  ) {
    if (!details.open) {
      details.open = true;
      opened = true;
    }
  }
  if (opened) {
    target.scrollIntoView({ block: 'start' });
  }
}
