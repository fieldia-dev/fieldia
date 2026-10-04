import { pageWords } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { COMMON_LANGUAGES, languageName, languagesOf, languageTag, pageLanguage } from './translations';
import { readTranslationsCsv, translationsCsv } from './translations-csv';
import { wordsGrid } from './translations-grid';

/**
 * Translations: the page's words in other languages, in place of the editor,
 * beside Design and Try it. A grid of every word, a column per language;
 * only the words not translated yet, at a switch; a language added by its
 * name or tag, and removed after asking in the page; the words copied as
 * CSV for a translator and their CSV pasted back to fill the grid.
 */

export interface TranslationsViewOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  /** The editor: the view goes at its end. */
  root: HTMLElement;
  /** What the editor shows when designing: hidden while the view shows. */
  body: HTMLElement;
  /** Design and Try it: Translations goes beside them. */
  modes: HTMLElement;
}

export interface TranslationsView {
  element: HTMLElement;
  readonly open: boolean;
  /** For Find anything: open it, add a language, and what it does once open. */
  items(): FindItem[];
  destroy(): void;
}

let views = 0;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function translationsView(options: TranslationsViewOptions): TranslationsView {
  const { el, doc, designer, root, body, modes } = options;
  const id = `fd-words-${++views}`;

  const toggle = el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': 'translations', 'aria-pressed': 'false' }, designerIcon(doc, 'website'), 'Translations');
  modes.append(toggle);
  modes.setAttribute('aria-label', 'Design, try or translate the page');

  // ---- the bar --------------------------------------------------------------
  // How many words, and the language they are written in: a picker, to say another.
  const count = el('span');
  const own = el('select', { class: 'fd-words-own-language', 'aria-label': 'The page’s own language' });
  const after = el('span');
  const note = el('p', { class: 'fd-words-note' }, count, own, after);
  own.addEventListener('change', () => designer.setPageLanguage(own.value));
  const onlySwitch = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-labelledby': `${id}-only` });
  const only = el('div', { class: 'fd-words-filter' }, onlySwitch, el('span', { id: `${id}-only` }, 'Only words not translated'));
  const addInput = el('input', { class: 'fd-input', list: `${id}-languages`, 'aria-label': 'Add a language', placeholder: 'Arabic, es, pt-BR…', autocomplete: 'off', spellcheck: 'false' });
  const known = el('datalist', { id: `${id}-languages` }, ...Object.entries(COMMON_LANGUAGES).map(([tag, name]) => el('option', { value: name, label: tag })));
  const add = el('form', { class: 'fd-words-add' }, addInput, known, el('button', { type: 'submit', class: 'fd-button' }, 'Add'));
  const copy = el('button', { type: 'button', class: 'fd-button' }, 'Copy as CSV');
  const paste = el('button', { type: 'button', class: 'fd-button' }, 'Paste CSV');
  const bar = el(
    'div',
    { class: 'fd-words-bar' },
    el('div', { class: 'fd-words-heading' }, el('h2', { class: 'fd-words-title' }, 'Translations'), note),
    only,
    add,
    el('div', { class: 'fd-words-actions' }, copy, paste)
  );

  // ---- asking before a language goes, in the page ----------------------------
  const askText = el('p', { class: 'fd-words-ask' });
  const removeIt = el('button', { type: 'button', class: 'fd-button fd-button-danger' });
  const keepIt = el('button', { type: 'button', class: 'fd-button' }, 'Keep it');
  const confirm = el('div', { class: 'fd-words-confirm', role: 'group', 'aria-label': 'Remove a language', hidden: '' }, askText, el('div', { class: 'fd-words-buttons' }, removeIt, keepIt));
  let removing: string | null = null;

  // ---- CSV in and out ------------------------------------------------------------
  const csvLabel = el('label', { for: `${id}-csv`, class: 'fd-words-csv-label' });
  const csvBox = el('textarea', { id: `${id}-csv`, class: 'fd-input fd-words-csv', rows: '6', spellcheck: 'false' });
  const csvProblem = el('p', { class: 'fd-words-problem', role: 'alert', hidden: '' });
  const fill = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, 'Fill the translations');
  const csvDone = el('button', { type: 'button', class: 'fd-button' }, 'Cancel');
  const csvPanel = el('div', { class: 'fd-words-paste', hidden: '' }, csvLabel, csvBox, csvProblem, el('div', { class: 'fd-words-buttons' }, fill, csvDone));

  const status = el('p', { class: 'fd-words-status', role: 'status' });
  const grid = wordsGrid({ el, doc, designer, onRemove: askRemove });
  const element = el('section', { class: 'fd-words', 'aria-label': 'Translations', hidden: '' }, bar, confirm, csvPanel, status, grid.element, grid.stale);
  root.append(element);

  const say = (words: string) => (status.textContent = words);

  function askRemove(tag: string) {
    const count = Object.keys(designer.getPage().translations?.[tag] ?? {}).length;
    const name = languageName(tag);
    // Nothing translated yet: nothing to lose, nothing to ask.
    if (!count) {
      if (designer.removeLanguage(tag)) say(`Removed ${name}.`);
      return;
    }
    removing = tag;
    say('');
    askText.textContent = `Remove ${name}? ${count === 1 ? 'Its 1 translation goes' : `Its ${count} translations go`} with it.`;
    removeIt.textContent = `Remove ${name}`;
    confirm.hidden = false;
    keepIt.focus();
  }
  function stopAsking(focus: boolean) {
    removing = null;
    confirm.hidden = true;
    if (focus) addInput.focus();
  }
  removeIt.addEventListener('click', () => {
    if (removing && designer.removeLanguage(removing)) say(`Removed ${languageName(removing)}. Undo brings it back.`);
    stopAsking(true);
  });
  keepIt.addEventListener('click', () => stopAsking(true));
  confirm.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    stopAsking(true);
  });

  add.addEventListener('submit', (event) => {
    event.preventDefault();
    const typed = addInput.value;
    // A name it does not know goes to the designer as typed, which says why it cannot be added.
    const tag = languageTag(typed) ?? typed;
    if (!designer.addLanguage(tag)) return;
    addInput.value = '';
    say(`Added ${languageName(tag)}.`);
    grid.focusLanguage(languagesOf(designer.getPage()).slice(-1)[0]);
  });

  onlySwitch.addEventListener('click', () => {
    const on = onlySwitch.getAttribute('aria-checked') !== 'true';
    onlySwitch.setAttribute('aria-checked', String(on));
    grid.setOnlyMissing(on);
  });

  /** The panel for CSV: to paste one in, or — with no clipboard to write to — to copy one out by hand. */
  function showCsv(mode: 'paste' | 'copy', text = '') {
    csvPanel.dataset['mode'] = mode;
    csvLabel.textContent =
      mode === 'paste'
        ? 'Paste a CSV: its first row names each column’s language (ar or Arabic), its first column holds the page’s words.'
        : 'Copy this CSV (Ctrl+C or ⌘C), for a spreadsheet or a translator.';
    csvBox.value = text;
    csvBox.readOnly = mode === 'copy';
    fill.hidden = mode === 'copy';
    csvDone.textContent = mode === 'copy' ? 'Done' : 'Cancel';
    csvProblem.hidden = true;
    csvPanel.hidden = false;
    csvBox.focus();
    if (mode === 'copy') csvBox.select();
  }
  const hideCsv = () => {
    csvPanel.hidden = true;
    paste.focus();
  };
  csvDone.addEventListener('click', hideCsv);
  paste.addEventListener('click', () => showCsv('paste'));
  copy.addEventListener('click', () => {
    const page = designer.getPage();
    const text = translationsCsv(page);
    const languages = languagesOf(page).length;
    const copied = `Copied ${plural(pageWords(page).length, 'word', 'words')}${languages ? ` in ${plural(languages, 'language', 'languages')}` : ''} as CSV.`;
    const clipboard = doc.defaultView?.navigator.clipboard;
    if (!clipboard) return showCsv('copy', text);
    clipboard.writeText(text).then(
      () => say(copied),
      () => showCsv('copy', text)
    );
  });
  fill.addEventListener('click', () => {
    const read = readTranslationsCsv(csvBox.value, designer.getPage());
    const problem = (words: string) => {
      csvProblem.textContent = words;
      csvProblem.hidden = false;
    };
    if ('problem' in read) return problem(read.problem);
    const filled = designer.fillTranslations(read.words);
    if (filled === false) return problem(designer.getState().issues[0] ?? 'Nothing could be filled');
    hideCsv();
    const left = read.notOnPage ? ` ${plural(read.notOnPage, 'word', 'words')} no longer on the page ${read.notOnPage === 1 ? 'was' : 'were'} left out.` : '';
    say(`Filled ${plural(filled, 'translation', 'translations')}.${left}`);
  });

  // ---- in place of the editor -----------------------------------------------------
  let open = false;
  const trying = () => !!root.querySelector('.fd-try:not([hidden])');
  const modeButton = (name: string) => modes.querySelector<HTMLButtonElement>(`[data-mode="${name}"]`);

  function show(next: boolean) {
    // From Try it: back to designing first, then here.
    if (next && trying()) modeButton('design')?.click();
    open = next;
    element.hidden = !open;
    body.hidden = open || trying();
    toggle.setAttribute('aria-pressed', String(open));
    if (open) modeButton('design')?.setAttribute('aria-pressed', 'false');
    else if (!trying()) modeButton('design')?.setAttribute('aria-pressed', 'true');
    if (!open) return;
    say('');
    stopAsking(false);
    // Nothing on the page is picked here: keys meant for a picked field must not reach it.
    designer.select(null);
    render();
  }
  toggle.addEventListener('click', () => show(true));
  // Design or Try it: the view gives way.
  const onMode = (event: Event) => {
    const button = (event.target as Element).closest('[data-mode]');
    if (open && button && button !== toggle) show(false);
  };
  modes.addEventListener('click', onMode);

  function render() {
    const page = designer.getPage();
    const words = pageWords(page).length;
    const languages = languagesOf(page).length;
    const language = pageLanguage(page);
    count.textContent = `${plural(words, 'word', 'words')}, written in `;
    // The common languages by name, and the page's own when it is not one of them.
    const offered = [...new Set([language, ...Object.keys(COMMON_LANGUAGES)])].sort((a, b) => languageName(a).localeCompare(languageName(b)));
    if ([...own.options].map((o) => o.value).join() !== offered.join()) own.replaceChildren(...offered.map((tag) => el('option', { value: tag }, languageName(tag))));
    own.value = language;
    after.textContent = `.${languages ? '' : ' Add a language to translate them into it.'}`;
    only.hidden = !languages;
    grid.update(page);
  }
  const leave = designer.subscribe((state) => {
    if (!open) return;
    // Something picked on the page: back to the editor, where it is.
    if (state.selected !== null) return show(false);
    render();
  });

  return {
    element,
    get open() {
      return open;
    },
    items() {
      const addOne = { label: 'Add a language', hint: 'Translations', run: () => (show(true), addInput.focus()) };
      // Try it in each language the page keeps: Try it, then the language picked there.
      const tries = languagesOf(designer.getPage()).map((tag) => ({
        label: `Try it in ${languageName(tag)}`,
        hint: 'Try it',
        run() {
          modeButton('try')?.click();
          const picker = root.querySelector<HTMLSelectElement>('.fd-try-language select');
          if (!picker) return;
          picker.value = tag;
          picker.dispatchEvent(new Event('change', { bubbles: true }));
        },
      }));
      if (!open) return [{ label: 'Translations', hint: 'the page’s words in other languages', run: () => show(true) }, addOne, ...tries];
      return [
        { label: 'Back to designing', hint: 'Design', run: () => show(false) },
        addOne,
        { label: 'Only words not translated', hint: 'Translations', run: () => onlySwitch.click() },
        { label: 'Copy as CSV', hint: 'Translations', run: () => copy.click() },
        { label: 'Paste CSV', hint: 'Translations', run: () => paste.click() },
        ...languagesOf(designer.getPage()).map((tag) => ({ label: `Remove ${languageName(tag)}`, hint: 'Translations', run: () => askRemove(tag) })),
        ...tries,
      ];
    },
    destroy() {
      leave();
      modes.removeEventListener('click', onMode);
      toggle.remove();
      element.remove();
    },
  };
}
