import { POPUP_LANGS, type PopupLang, readPref, writePref } from './prefs';

// EN / native switch on the grammar usage-point cards. The visible language is
// pure CSS off <html data-popup-lang> (set before first paint by the boot
// script), so this only persists the choice and keeps aria-pressed in step on
// every card's switch.
function sync(root: ParentNode, lang: PopupLang): void {
  for (const button of root.querySelectorAll<HTMLElement>(
    '[data-usage-lang]',
  )) {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.usageLang === lang),
    );
  }
}

export function initGrammarLangToggle(root: Document): void {
  sync(root, readPref('popupLang'));
  root.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>(
      '[data-usage-lang]',
    );
    const lang = button?.dataset.usageLang as PopupLang | undefined;
    if (!lang || !(POPUP_LANGS as readonly string[]).includes(lang)) {
      return;
    }
    writePref('popupLang', lang);
    sync(root, lang);
  });
}
