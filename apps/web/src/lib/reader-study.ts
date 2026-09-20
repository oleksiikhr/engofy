import { initQuickCheck, type QuickCheckHandle } from './quick-check';
import type { FinishDetail } from './reader-final';
import {
  type GrammarLexiconEntry,
  type LexiconData,
  lexiconActionsHtml,
  type WordLexiconEntry,
} from './reader-lexicon';

// Study mode: a forced, paragraph-by-paragraph pass through the article. Only
// the current block is at full strength (the rest is dimmed, in CSS via
// `.reader-study` / `.is-current`); a panel under it offers the block's new
// words (one to add right there, the rest one click away), an optional grammar
// check-in, and the block's own questions: recall of its due cards and its
// exercises, rendered by the Quick check card from `<template data-study-steps>`
// elements. It never blocks — "Continue" and "Exit study mode" are always
// there. Finishing hands the score over to the final screen.

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

const MAX_TERM_CHIPS = 5;

// The block's other new words and phrases; a chip opens the same popup the
// article's own highlight does.
function termChipsHtml(terms: { id: string; label: string }[]): string {
  if (terms.length === 0) {
    return '';
  }
  return `<div class="study-panel__terms">
  <p class="study-panel__label">Also new here</p>
  ${terms.map((t) => `<button type="button" class="tag study-panel__term-chip" data-study-term="${esc(t.id)}">${esc(t.label)}</button>`).join(' ')}
</div>`;
}

function checkinHtml(entry: GrammarLexiconEntry): string {
  return `<details class="study-panel__checkin">
  <summary>Grammar check-in: ${esc(entry.guideword)}</summary>
  <p>${esc(entry.explanation ?? entry.canDoStatement)}</p>
  ${entry.contrast ? `<p><b>Why this form?</b> ${esc(entry.contrast)}</p>` : ''}
</details>`;
}

export interface StudyOptions {
  root: HTMLElement;
  toggle: HTMLElement;
  lexicon: LexiconData;
  // New cards still allowed today; null for a guest (no suggestions).
  budget: number | null;
  onFinish: (result: FinishDetail) => void;
}

export function initReaderStudy(options: StudyOptions): void {
  const { root, toggle, lexicon, onFinish } = options;
  let budget = options.budget;
  let added = 0;
  let answered = 0;
  let correct = 0;
  let cleared = 0;
  let active = false;
  let blocks: HTMLElement[] = [];
  let current = 0;
  let quiz: QuickCheckHandle | null = null;
  const offered = new Set<string>();
  const panel = document.createElement('div');
  panel.className = 'study-panel';

  const setActive = (on: boolean) => {
    active = on;
    document.body.classList.toggle('reader-study', on);
    toggle.setAttribute('aria-pressed', String(on));
    if (!on) {
      panel.remove();
      quiz = null;
      for (const block of blocks) {
        block.classList.remove('is-current');
      }
      window.dispatchEvent(new Event('resize'));
    }
  };

  // The block's new words and phrases, in reading order, one per id.
  const newTerms = (block: HTMLElement) => {
    const seen = new Set<string>();
    const terms: { id: string; label: string }[] = [];
    for (const span of block.querySelectorAll(
      '[data-word-definition-id], [data-phrase-id]',
    )) {
      const wordId = span.getAttribute('data-word-definition-id');
      const id = wordId ?? span.getAttribute('data-phrase-id') ?? '';
      const entry = wordId ? lexicon.words[id] : lexicon.phrases[id];
      if (entry?.state !== 'new' || seen.has(id)) {
        continue;
      }
      seen.add(id);
      terms.push({
        id,
        label: 'lemma' in entry ? entry.lemma : entry.text,
      });
    }
    return terms;
  };

  const panelHtml = (block: HTMLElement, last: boolean): string => {
    let html = '';
    let offeredId: string | null = null;
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
        offeredId = word.id;
        html += suggestionHtml(word);
      }
    }
    html += termChipsHtml(
      newTerms(block)
        .filter((term) => term.id !== offeredId)
        .slice(0, MAX_TERM_CHIPS),
    );
    const grammarId = block
      .querySelector('[data-grammar-usage-point-id]:not([data-known])')
      ?.getAttribute('data-grammar-usage-point-id');
    const grammar = grammarId ? lexicon.grammar[grammarId] : undefined;
    if (grammar) {
      html += checkinHtml(grammar);
    }
    html += '<div class="study-panel__quiz" data-study-quiz></div>';
    const score = answered > 0 ? ` · ${correct}/${answered} correct` : '';
    html += `<div class="study-panel__nav">
  <button type="button" class="btn" data-study="next">${last ? 'Finish' : 'Continue'}</button>
  <button type="button" class="btn btn--ghost" data-study="exit">Exit study mode</button>
  <span class="meta num study-panel__progress" data-study-progress>Paragraph ${current + 1} / ${blocks.length}${score}</span>
</div>`;
    return html;
  };

  // The block's questions (recall + exercises) as an inline Quick check card.
  const mountQuiz = (block: HTMLElement) => {
    quiz = null;
    const host = panel.querySelector<HTMLElement>('[data-study-quiz]');
    const template = root.ownerDocument.querySelector<HTMLTemplateElement>(
      `template[data-study-steps="${block.dataset.block}"]`,
    );
    const card = template?.content.firstElementChild?.cloneNode(true);
    if (!host || !(card instanceof HTMLElement)) {
      return;
    }
    host.append(card);
    quiz = initQuickCheck(card, {
      onComplete: (tally) => {
        card.hidden = true;
        host.insertAdjacentHTML(
          'beforeend',
          `<p class="study-panel__done" role="status">Questions done: ${tally.correct}/${tally.answered} correct.</p>`,
        );
        panel.querySelector<HTMLElement>('[data-study="next"]')?.focus();
      },
    });
    quiz.start();
  };

  // The current block's score joins the running total when it is left.
  const bank = () => {
    if (quiz) {
      const tally = quiz.tally();
      answered += tally.answered;
      correct += tally.correct;
      cleared += tally.cleared;
    }
    quiz = null;
  };

  const show = (index: number) => {
    current = index;
    blocks.forEach((block, i) => {
      block.classList.toggle('is-current', i === index);
    });
    const block = blocks[index];
    panel.innerHTML = panelHtml(block, index === blocks.length - 1);
    block.after(panel);
    mountQuiz(block);
    window.htmx?.process(panel);
    block.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.dispatchEvent(new Event('resize'));
  };

  panel.addEventListener('click', (event) => {
    const target = event.target as Element;
    const chip = target.closest<HTMLElement>('[data-study-term]');
    if (chip) {
      const id = chip.dataset.studyTerm ?? '';
      const span = blocks[current].querySelector(
        `[data-word-definition-id="${id}"], [data-phrase-id="${id}"]`,
      );
      const rect = span?.getBoundingClientRect();
      span?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientY: rect?.top ?? 0,
        }),
      );
      return;
    }
    const action = target.closest('[data-study]')?.getAttribute('data-study');
    if (action === 'exit') {
      setActive(false);
    } else if (action === 'next') {
      bank();
      if (current + 1 < blocks.length) {
        show(current + 1);
      } else {
        setActive(false);
        onFinish({ added, answered, correct, cleared });
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
    answered = 0;
    correct = 0;
    cleared = 0;
    setActive(true);
    show(0);
  });
}
