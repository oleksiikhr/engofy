import {
  type GrammarLexiconEntry,
  type LexiconData,
  lexiconActionsHtml,
  type WordLexiconEntry,
} from './reader-lexicon';

// Study mode: a forced, paragraph-by-paragraph pass through the article. Only
// the current block is at full strength (the rest is dimmed, in CSS via
// `.reader-study` / `.is-current`); a panel under it offers a new word to add
// and an optional grammar check-in before "Continue". It never blocks —
// "Exit study mode" is always there. Finishing hands over to the final screen.

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function cefrRank(level: string | null): number {
  const rank = level ? CEFR_ORDER.indexOf(level) : -1;
  return rank === -1 ? CEFR_ORDER.length : rank;
}

// The next word worth offering: closest to the learner's level first (a word
// at or below it never reads as New), then the most frequent.
export function pickNewWord(
  candidates: WordLexiconEntry[],
): WordLexiconEntry | null {
  const rankOf = (w: WordLexiconEntry) => w.frequencyRank ?? Number.MAX_VALUE;
  const sorted = [...candidates].sort(
    (a, b) =>
      cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel) || rankOf(a) - rankOf(b),
  );
  return sorted[0] ?? null;
}

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

function suggestionHtml(word: WordLexiconEntry): string {
  const sub = [word.pos, word.phonetic].filter(Boolean).join(' · ');
  return `<section class="study-panel__suggest" data-study-word="${esc(word.id)}">
  <p class="study-panel__label">New word for your deck?</p>
  <p><b class="study-panel__term">${esc(word.lemma)}</b>${sub ? ` <span class="study-panel__sub">${esc(sub)}</span>` : ''}</p>
  ${word.definition ? `<p>${esc(word.definition)}</p>` : ''}
  ${lexiconActionsHtml({ kind: 'word', id: word.id }, 'new')}
</section>`;
}

function checkinHtml(entry: GrammarLexiconEntry): string {
  return `<details class="study-panel__checkin">
  <summary>Grammar check-in: ${esc(entry.guideword)}</summary>
  <p>${esc(entry.canDoStatement)}</p>
  ${entry.contrast ? `<p><b>Why this form?</b> ${esc(entry.contrast)}</p>` : ''}
</details>`;
}

export interface StudyOptions {
  root: HTMLElement;
  toggle: HTMLElement;
  lexicon: LexiconData;
  // New cards still allowed today; null for a guest (no suggestions).
  budget: number | null;
  onFinish: (result: { added: number }) => void;
}

export function initReaderStudy(options: StudyOptions): void {
  const { root, toggle, lexicon, onFinish } = options;
  let budget = options.budget;
  let added = 0;
  let active = false;
  let blocks: HTMLElement[] = [];
  let current = 0;
  const offered = new Set<string>();
  const panel = document.createElement('div');
  panel.className = 'study-panel';

  const setActive = (on: boolean) => {
    active = on;
    document.body.classList.toggle('reader-study', on);
    toggle.setAttribute('aria-pressed', String(on));
    if (!on) {
      panel.remove();
      for (const block of blocks) {
        block.classList.remove('is-current');
      }
      window.dispatchEvent(new Event('resize'));
    }
  };

  const panelHtml = (block: HTMLElement, last: boolean): string => {
    let html = '';
    if (budget !== null && budget > 0) {
      const candidates = Array.from(
        block.querySelectorAll('[data-word-definition-id]'),
      )
        .map(
          (span) =>
            lexicon.words[span.getAttribute('data-word-definition-id') ?? ''],
        )
        .filter(
          (w): w is WordLexiconEntry =>
            !!w && w.state === 'new' && !offered.has(w.id),
        );
      const word = pickNewWord(candidates);
      if (word) {
        offered.add(word.id);
        html += suggestionHtml(word);
      }
    }
    const grammarId = block
      .querySelector('[data-grammar-usage-point-id]')
      ?.getAttribute('data-grammar-usage-point-id');
    const grammar = grammarId ? lexicon.grammar[grammarId] : undefined;
    if (grammar) {
      html += checkinHtml(grammar);
    }
    html += `<div class="study-panel__nav">
  <button type="button" class="btn" data-study="next">${last ? 'Finish' : 'Continue'}</button>
  <button type="button" class="btn btn--ghost" data-study="exit">Exit study mode</button>
</div>`;
    return html;
  };

  const show = (index: number) => {
    current = index;
    blocks.forEach((block, i) => {
      block.classList.toggle('is-current', i === index);
    });
    const block = blocks[index];
    panel.innerHTML = panelHtml(block, index === blocks.length - 1);
    block.after(panel);
    window.htmx?.process(panel);
    block.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.dispatchEvent(new Event('resize'));
  };

  panel.addEventListener('click', (event) => {
    const action = (event.target as Element)
      .closest('[data-study]')
      ?.getAttribute('data-study');
    if (action === 'exit') {
      setActive(false);
    } else if (action === 'next') {
      if (current + 1 < blocks.length) {
        show(current + 1);
      } else {
        setActive(false);
        onFinish({ added });
      }
    }
  });

  // A saved suggestion uses up one of today's slots.
  panel.addEventListener('htmx:afterSwap', () => {
    const section = panel.querySelector('[data-study-word]');
    const state = section
      ?.querySelector('.lex-state')
      ?.getAttribute('data-state');
    if (
      section &&
      state === 'learning' &&
      !section.hasAttribute('data-counted')
    ) {
      section.setAttribute('data-counted', '');
      added += 1;
      if (budget !== null) {
        budget -= 1;
      }
    }
  });

  toggle.addEventListener('click', () => {
    if (active) {
      setActive(false);
      return;
    }
    blocks = Array.from(
      root.querySelectorAll<HTMLElement>(':scope > [data-block]'),
    );
    if (blocks.length === 0) {
      return;
    }
    setActive(true);
    show(0);
  });
}
