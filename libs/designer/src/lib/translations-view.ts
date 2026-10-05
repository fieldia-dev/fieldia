import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { COMMON_LANGUAGES, languageName, languagesOf, languageTag, pageLanguage, wordsOf } from './translations';
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

export function translationsView(options: TranslationsViewOptions): TranslationsView {
  const { el, doc, designer, root, body, modes } = options;
  const id = `fd-words-${++views}`;
  const said = designer.words;
  const w = said.translations;
  const nameOf = (tag: string) => languageName(tag, said);

  const toggle = el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': 'translations', 'aria-pressed': 'false' }, designerIcon(doc, 'website'), w.title);
  modes.append(toggle);
  modes.setAttribute('aria-label', w.modes);

  // ---- the bar --------------------------------------------------------------
  // How many words, and the language they are written in: a picker, to say another.
  const count = el('span');
  const own = el('select', { class: 'fd-words-own-language', 'aria-label': w.ownLanguage });
  const after = el('span');
  const note = el('p', { class: 'fd-words-note' }, count, own, after);
  own.addEventListener('change', () => designer.setPageLanguage(own.value));
  const onlySwitch = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-labelledby': `${id}-only` });
  const only = el('div', { class: 'fd-words-filter' }, onlySwitch, el('span', { id: `${id}-only` }, w.onlyMissing));
  const addInput = el('input', { class: 'fd-input', list: `${id}-languages`, 'aria-label': w.addLanguage, placeholder: w.addExample, autocomplete: 'off', spellcheck: 'false' });
  const known = el('datalist', { id: `${id}-languages` }, ...Object.keys(COMMON_LANGUAGES).map((tag) => el('option', { value: nameOf(tag), label: tag })));
  const add = el('form', { class: 'fd-words-add' }, addInput, known, el('button', { type: 'submit', class: 'fd-button' }, w.add));
  const copy = el('button', { type: 'button', class: 'fd-button' }, w.copyCsv);
  const paste = el('button', { type: 'button', class: 'fd-button' }, w.pasteCsv);
  const bar = el(
    'div',
    { class: 'fd-words-bar' },
    el('div', { class: 'fd-words-heading' }, el('h2', { class: 'fd-words-title' }, w.title), note),
    only,
    add,
    el('div', { class: 'fd-words-actions' }, copy, paste)
  );

  // ---- asking before a language goes, in the page ----------------------------
  const askText = el('p', { class: 'fd-words-ask' });
  const removeIt = el('button', { type: 'button', class: 'fd-button fd-button-danger' });
  const keepIt = el('button', { type: 'button', class: 'fd-button' }, w.keepIt);
  const confirm = el('div', { class: 'fd-words-confirm', role: 'group', 'aria-label': w.removeALanguage, hidden: '' }, askText, el('div', { class: 'fd-words-buttons' }, removeIt, keepIt));
  let removing: string | null = null;

  // ---- CSV in and out ------------------------------------------------------------
  const csvLabel = el('label', { for: `${id}-csv`, class: 'fd-words-csv-label' });
  const csvBox = el('textarea', { id: `${id}-csv`, class: 'fd-input fd-words-csv', rows: '6', spellcheck: 'false' });
  const csvProblem = el('p', { class: 'fd-words-problem', role: 'alert', hidden: '' });
  const fill = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, w.fill);
  const csvDone = el('button', { type: 'button', class: 'fd-button' }, w.cancel);
  const csvPanel = el('div', { class: 'fd-words-paste', hidden: '' }, csvLabel, csvBox, csvProblem, el('div', { class: 'fd-words-buttons' }, fill, csvDone));

  const status = el('p', { class: 'fd-words-status', role: 'status' });
  const grid = wordsGrid({ el, doc, designer, onRemove: askRemove });
  const element = el('section', { class: 'fd-words', 'aria-label': w.title, hidden: '' }, bar, confirm, csvPanel, status, grid.element, grid.stale);
  root.append(element);

  const say = (words: string) => (status.textContent = words);

  function askRemove(tag: string) {
    const count = Object.keys(designer.getPage().translations?.[tag] ?? {}).length;
    const name = nameOf(tag);
    // Nothing translated yet: nothing to lose, nothing to ask.
    if (!count) {
      if (designer.removeLanguage(tag)) say(w.removed(name));
      return;
    }
    removing = tag;
    say('');
    askText.textContent = w.askRemove(name, count);
    removeIt.textContent = w.remove(name);
    confirm.hidden = false;
    keepIt.focus();
  }
  function stopAsking(focus: boolean) {
    removing = null;
    confirm.hidden = true;
    if (focus) addInput.focus();
  }
  removeIt.addEventListener('click', () => {
    if (removing && designer.removeLanguage(removing)) say(w.removedUndo(nameOf(removing)));
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
    const tag = languageTag(typed, said) ?? typed;
    if (!designer.addLanguage(tag)) return;
    addInput.value = '';
    say(w.added(nameOf(tag)));
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
      mode === 'paste' ? w.pasteLabel : w.copyLabel;
    csvBox.value = text;
    csvBox.readOnly = mode === 'copy';
    fill.hidden = mode === 'copy';
    csvDone.textContent = mode === 'copy' ? w.done : w.cancel;
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
    const copied = w.copied(wordsOf(page).length, languages);
    const clipboard = doc.defaultView?.navigator.clipboard;
    if (!clipboard) return showCsv('copy', text);
    clipboard.writeText(text).then(
      () => say(copied),
      () => showCsv('copy', text)
    );
  });
  fill.addEventListener('click', () => {
    const read = readTranslationsCsv(csvBox.value, designer.getPage(), said);
    const problem = (text: string) => {
      csvProblem.textContent = text;
      csvProblem.hidden = false;
    };
    if ('problem' in read) return problem(read.problem);
    const filled = designer.fillTranslations(read.words);
    if (filled === false) return problem(designer.getState().issues[0] ?? w.nothingFilled);
    hideCsv();
    say(w.filled(filled, read.notOnPage));
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
  // Design or Try it: the view gives way, and the editor comes back. Another view in its place (the JSON): it only steps aside.
  const onMode = (event: Event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-mode]');
    if (!open || !button || button === toggle) return;
    if (button.dataset['mode'] === 'design' || button.dataset['mode'] === 'try') return show(false);
    open = false;
    element.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
  };
  modes.addEventListener('click', onMode);

  function render() {
    const page = designer.getPage();
    const words = wordsOf(page).length;
    const languages = languagesOf(page).length;
    const language = pageLanguage(page);
    // The sentence as the words have it, the page's language picked where it names it.
    const [before, rest = ''] = w.note(words, languages).split('{language}');
    count.textContent = before;
    // The common languages by name, and the page's own when it is not one of them.
    const offered = [...new Set([language, ...Object.keys(COMMON_LANGUAGES)])].sort((a, b) => nameOf(a).localeCompare(nameOf(b), designer.locale ?? undefined));
    if ([...own.options].map((o) => o.value).join() !== offered.join()) own.replaceChildren(...offered.map((tag) => el('option', { value: tag }, nameOf(tag))));
    own.value = language;
    after.textContent = rest;
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
      const addOne = { label: w.addLanguage, hint: w.title, run: () => (show(true), addInput.focus()) };
      // Try it in each language the page keeps: Try it, then the language picked there.
      const tries = languagesOf(designer.getPage()).map((tag) => ({
        label: w.tryIn(nameOf(tag)),
        hint: said.tryIt.tryIt,
        run() {
          modeButton('try')?.click();
          const picker = root.querySelector<HTMLSelectElement>('.fd-try-language select');
          if (!picker) return;
          picker.value = tag;
          picker.dispatchEvent(new Event('change', { bubbles: true }));
        },
      }));
      if (!open) return [{ label: w.title, hint: w.pageWordsElsewhere, run: () => show(true) }, addOne, ...tries];
      return [
        { label: said.tryIt.backToDesigning, hint: said.tryIt.design, run: () => show(false) },
        addOne,
        { label: w.onlyMissing, hint: w.title, run: () => onlySwitch.click() },
        { label: w.copyCsv, hint: w.title, run: () => copy.click() },
        { label: w.pasteCsv, hint: w.title, run: () => paste.click() },
        ...languagesOf(designer.getPage()).map((tag) => ({ label: w.remove(nameOf(tag)), hint: w.title, run: () => askRemove(tag) })),
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
