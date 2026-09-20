// Filters the rendered /grammar list by name and summary as the learner types.
// The list is already in the page, so no request is made; the level filter's
// HTMX swap replaces #grammar-results, and the search is applied again to it.

export function matchesQuery(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function initGrammarSearch(
  input: HTMLInputElement,
  startHere: HTMLElement | null,
): void {
  const apply = () => {
    const query = input.value;
    const results = document.getElementById('grammar-results');
    if (!results) {
      return;
    }
    let shown = 0;
    for (const item of results.querySelectorAll<HTMLElement>('li')) {
      const card = item.querySelector<HTMLElement>('.grammar-con');
      const text = [
        card?.querySelector('.grammar-con__name')?.textContent,
        card?.querySelector('.grammar-con__summary')?.textContent,
      ].join(' ');
      const match = matchesQuery(text, query);
      item.hidden = !match;
      shown += match ? 1 : 0;
    }
    for (const group of results.querySelectorAll<HTMLElement>('.grammar-cat')) {
      group.hidden = !group.querySelector('li:not([hidden])');
    }
    const empty = document.getElementById('grammar-search-empty');
    if (empty) {
      empty.hidden = shown > 0 || query.trim() === '';
    }
    if (startHere) {
      startHere.hidden = query.trim() !== '';
    }
  };
  input.addEventListener('input', apply);
  document.body.addEventListener('htmx:afterSettle', apply);
  apply();
}
