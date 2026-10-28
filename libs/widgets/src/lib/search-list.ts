import { foldForSearch } from '@fieldia/core';
import { keepTabIn } from './focus-trap';
import { setAttr, setHidden, type Make } from './kind-parts';
import { scrollToRow, typedKey } from './pick-list';
import { popup } from './popup';

/**
 * A long list that does not change, picked by typing — a phone's country among two hundred and forty — in place of
 * the browser's own list, which is found only by scrolling or by its first letters. Pressed (or reached by the keys
 * and opened with ↓, Enter or Space, or by typing), a box to type in opens over the page with the list under it: a
 * row for each choice, what it leads with (a flag) before its words and what it ends with (a dialling code) after;
 * the few the page puts first (its own country, the reader's) above the rest. Typed words find a row by any of its
 * words — its name in the page's language and in English, its code, its number ("eg", "Egypt", "مصر", "+20", "20") —
 * the best first: a code or a number that is the row's, then words that start a name, then words inside one. ↓ and
 * ↑ move through the rows, Page Down and Page Up eight at a time, Enter picks, Escape and Tab close it, picking
 * nothing. The ARIA practices' combobox in a popup: the box owns the list, the row reached is its active descendant.
 *
 * On a narrow screen (a phone's) it opens as a sheet from the foot of the screen, over a dimmed page, its title and
 * Close at its head: pressed outside or closed, it goes, and Tab stays in it. Right to left it opens from the start of
 * the page's line, as everything else does; a number in it reads left to right.
 */

export interface SearchRow {
  /** What is picked. */
  readonly value: string;
  /** Its words, in the page's language. */
  readonly words: string;
  /** What else finds it — its words in English, its code — beside its words. */
  readonly also: readonly string[];
  /** What finds it as a number, typed with or without its + ("+20", "20", "0020"). */
  readonly number?: string;
  /** Drawn before its words: a flag. */
  readonly lead?: string;
  /** Drawn after them, left to right: a dialling code. */
  readonly trail?: string;
}

export interface SearchListOptions {
  make: Make;
  /** The ids its parts take theirs from. */
  id: string;
  /** The widget's element: where it opens from (it is out of the page while closed). */
  home: HTMLElement;
  /** The button that opens it. */
  button: HTMLElement;
  /** What finds a row in it, put first among the rows, and the rest, in the page's language's order. */
  rows: readonly SearchRow[];
  /** The rows put first, by their values, while nothing is typed. */
  first: () => readonly string[];
  /** The value picked now: its row ticked, and where the list opens. */
  picked: () => string | null;
  pick: (value: string) => void;
  /**
   * Its words: `title` names it (the sheet's name: "Country of Phone"), `heading` heads it where it shows as a sheet —
   * what it lists ("Country"), the field it opened from being the one just pressed; the title unless given.
   */
  words: { find: string; list: string; none: string; title: string; heading?: string; close: string };
}

export interface SearchList {
  /** Open it, with what was typed on the button to start the search. */
  open(typed?: string): void;
  close(focusBack: boolean): void;
  isOpen(): boolean;
}

/** How well a row answers what is typed: 0 best, null not at all. */
function rank(row: Folded, typed: string, digits: string | null): number | null {
  if (digits !== null) return row.number === undefined ? null : row.number === digits ? 0 : row.number.startsWith(digits) ? 1 : null;
  if (row.codes.includes(typed)) return 0;
  if (row.names.some((name) => name.startsWith(typed))) return 1;
  if (row.names.some((name) => name.includes(` ${typed}`) || name.includes(`-${typed}`))) return 2;
  return row.names.some((name) => name.includes(typed)) ? 3 : null;
}

interface Folded {
  readonly row: SearchRow;
  readonly names: string[];
  readonly codes: string[];
  readonly number?: string;
}

export function searchList(options: SearchListOptions): SearchList {
  const { make, id, home, button, words } = options;
  const doc = home.ownerDocument;
  const fold = (text: string) => foldForSearch(text).trim();
  const listId = `${id}-list`;
  const find = make('input', {
    type: 'search',
    class: 'fd-input fd-lookup-find',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'true',
    'aria-controls': listId,
    'aria-label': words.find,
    placeholder: words.find,
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
    // What is typed reads its own way: "+20" left to right on an Arabic page, a name in Arabic right to left.
    dir: 'auto',
  }) as HTMLInputElement;
  const list = make('div', { id: listId, role: 'listbox', class: 'fd-lookup-rows', 'aria-label': words.list });
  const none = make('p', { class: 'fd-lookup-none', role: 'status', 'aria-live': 'polite' });
  const close = make('button', { type: 'button', class: 'fd-dialog-close fd-lookup-close', 'aria-label': words.close, title: words.close }, '×');
  const head = make('div', { class: 'fd-lookup-head' }, make('h2', { id: `${id}-title`, class: 'fd-lookup-title' }, words.heading ?? words.title), close);
  const panel = make('div', { class: 'fd-lookup-list', hidden: '' }, head, find, list, none);

  // Each row drawn once, the first time the list opens (a page of many phones draws none until then), its words folded
  // as a search finds them; the first rows are copies of theirs, before the rest.
  let all: { f: Folded; element: HTMLElement }[] = [];
  let byValue = new Map<string, Folded>();
  function drawRows() {
    if (all.length) return;
    const folded: Folded[] = options.rows.map((row) => ({
      row,
      names: [row.words, ...row.also.filter((word) => word.length > 2)].map(fold),
      codes: row.also.filter((word) => word.length <= 2).map(fold),
      number: row.number,
    }));
    all = folded.map((f) => ({ f, element: rowOf(f.row, f.row.value) }));
    byValue = new Map(folded.map((f) => [f.row.value, f]));
  }
  const rowOf = (row: SearchRow, key: string) => {
    const element = make(
      'div',
      { id: `${listId}-${key}`, role: 'option', class: 'fd-lookup-row', 'aria-selected': 'false', 'data-value': row.value },
      make('span', { class: 'fd-lookup-lead', 'aria-hidden': 'true' }, row.lead ?? ''),
      make('span', { class: 'fd-lookup-words' }, row.words),
      ...(row.trail ? [make('span', { class: 'fd-lookup-trail', dir: 'ltr' }, row.trail)] : [])
    );
    element.addEventListener('mousedown', (event) => event.preventDefault()); // the box keeps the focus
    element.addEventListener('click', () => choose(row.value));
    return element;
  };
  /** The rows shown now, in their order: the first ones, then the rest, or what typing found. */
  let shown: HTMLElement[] = [];
  let active = -1;
  let sheet: HTMLElement | null = null;

  function draw() {
    drawRows();
    const typed = fold(find.value);
    const plain = find.value.trim().replace(/[\s()-]/g, '');
    const digits = /^(\+|00)?\d+$/.test(plain) ? plain.replace(/^(\+|00)/, '') : null;
    let rows: HTMLElement[];
    if (!typed) {
      const first = [...new Set(options.first())].filter((value) => byValue.has(value));
      rows = [...first.map((value, at) => {
        const row = rowOf((byValue.get(value) as Folded).row, `first-${value}`);
        row.setAttribute('data-first', at === first.length - 1 ? 'last' : '');
        return row;
      }), ...all.map((r) => r.element)];
    } else {
      rows = all
        .map((r, at) => ({ r, at, rank: rank(r.f, typed, digits) }))
        .filter((found): found is { r: (typeof all)[number]; at: number; rank: number } => found.rank !== null)
        .sort((a, b) => a.rank - b.rank || a.at - b.at)
        .map((found) => found.r.element);
    }
    list.replaceChildren(...rows);
    shown = rows;
    const picked = options.picked();
    for (const row of shown) setAttr(row, 'aria-selected', String(row.dataset['value'] === picked));
    none.textContent = rows.length ? '' : words.none.replace('{text}', find.value.trim());
    setHidden(none, !!rows.length);
    // Typing reaches the best row; opened, the one picked — among the first rows where it is one, the list at its top.
    reach(typed ? 0 : Math.max(0, rows.findIndex((row) => row.dataset['value'] === picked)));
  }
  function reach(at: number) {
    active = shown.length ? Math.max(0, Math.min(at, shown.length - 1)) : -1;
    shown.forEach((row, i) => setAttr(row, 'data-active', i === active ? '' : null));
    setAttr(find, 'aria-activedescendant', active >= 0 ? shown[active].id : null);
    if (active >= 0) scrollToRow(list, shown[active]);
  }
  function choose(value: string) {
    shut(false);
    options.pick(value);
  }

  // Out of the page while closed — no second box, no second Close in it — however it closed (a press beside it too).
  const floating = popup(home, button, panel, () => panel.remove(), { alignTo: button, gap: 4 });
  /**
   * The look of the form it is on, worn by the sheet, which opens over the page outside it: its skin and theme
   * (`fd-theme`), and its scheme, accent, font and corners, which a dialog of the page's wears (`fd-form-dialog`) — dark
   * on a dark page, as the scan sheet and Import are; its tokens through its style object (below).
   */
  const LOOK = (name: string) => (name.startsWith('data-') && name !== 'data-max-width') || name === 'dir' || name === 'lang';
  function open(typed = '') {
    if (isOpen()) return;
    find.value = typed;
    const narrow = doc.defaultView?.matchMedia?.('(max-width: 600px)').matches === true;
    if (narrow) {
      const root = home.closest<HTMLElement>('.fd-form');
      for (const { name, value } of [...(root?.attributes ?? [])]) if (LOOK(name)) panel.setAttribute(name, value);
      // Its tokens and accent through the style object, which a strict policy lets be: a style attribute it refuses.
      if (root) panel.style.cssText = root.style.cssText;
      panel.classList.add('fd-theme', 'fd-form-dialog', 'fd-lookup-sheet');
      setAttr(panel, 'role', 'dialog');
      setAttr(panel, 'aria-modal', 'true');
      // Named by its title, whose words its heading begins with ("Country of Phone", "Country").
      if (words.heading && words.heading !== words.title) setAttr(panel, 'aria-label', words.title);
      else setAttr(panel, 'aria-labelledby', `${id}-title`);
      sheet = make('div', { class: 'fd-dialog-backdrop fd-lookup-back' }, panel);
      sheet.addEventListener('pointerdown', (event) => event.target === sheet && shut(true));
      (doc.body ?? doc.documentElement).append(sheet);
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    } else {
      // Its rows in before it is placed: placed by its height, under the flag or over it (popup.ts, room.ts).
      home.append(panel);
      draw();
      floating.open();
    }
    if (narrow) draw();
    // Moved to where it floats, the row reached is scrolled to again.
    else if (active >= 0) scrollToRow(list, shown[active]);
    find.focus();
    if (typed) find.setSelectionRange(typed.length, typed.length);
  }
  function shut(focusBack: boolean) {
    if (!isOpen()) return;
    if (sheet) {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      panel.remove();
      for (const { name } of [...panel.attributes]) if (LOOK(name) || name === 'role' || name.startsWith('aria-')) panel.removeAttribute(name);
      panel.classList.remove('fd-theme', 'fd-form-dialog', 'fd-lookup-sheet');
      sheet.remove();
      sheet = null;
    } else floating.close();
    find.value = '';
    if (focusBack) button.focus();
  }
  const isOpen = () => panel.isConnected && !panel.hidden;

  find.addEventListener('input', draw);
  find.addEventListener('keydown', (event) => {
    const to = ({ ArrowDown: active + 1, ArrowUp: active - 1, PageDown: active + 8, PageUp: active - 8 } as Record<string, number>)[event.key];
    if (to !== undefined) {
      event.preventDefault();
      reach(to);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active >= 0) choose(shown[active].dataset['value'] as string);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Only the list closes: not a dialog the field is in.
      event.stopPropagation();
      shut(true);
    } else if (event.key === 'Tab') {
      if (sheet) keepTabIn(panel, event);
      else shut(false);
    }
  });
  close.addEventListener('click', () => shut(true));
  close.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && sheet) keepTabIn(panel, event);
    if (event.key === 'Escape') {
      event.stopPropagation();
      shut(true);
    }
  });
  // The focus gone elsewhere (but into the sheet's own Close), the list goes too.
  panel.addEventListener('focusout', (event) => {
    if (isOpen() && !sheet && !panel.contains(event.relatedTarget as Node | null) && event.relatedTarget !== button) shut(false);
  });
  button.addEventListener('click', () => (isOpen() ? shut(true) : open()));
  button.addEventListener('keydown', (event) => {
    if (typedKey(event)) {
      event.preventDefault();
      open(event.key);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  return { open, close: shut, isOpen };
}
