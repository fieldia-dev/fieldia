import { isRightToLeft, type Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { languageName, languagesOf, pageLanguage, staleWords, translationProgress, wordsOf } from './translations';

/**
 * The grid of the Translations view: a row per word on the page, in reading
 * order; the page's own words first, then a column per language, each cell
 * typed in where it stands — right to left for a language written so — and
 * each column saying how far it has got. Enter and the arrows move between
 * cells as in a sheet. Under it, the translations of words no longer on the
 * page, to let go of one by one or all at once.
 */

export interface WordsGridOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  /** A language's remove button was pressed: the view asks first. */
  onRemove(tag: string): void;
}

export interface WordsGrid {
  /** The grid, in a box of its own that scrolls both ways. */
  element: HTMLElement;
  /** The translations of words no longer on the page. */
  stale: HTMLElement;
  update(page: Page): void;
  /** Only the words some language has not got — decided now, not as each word is typed, so a row stays while it is filled. */
  setOnlyMissing(on: boolean): void;
  /** The first cell of a language, to type in. */
  focusLanguage(tag: string): void;
}

/** A language's own name for itself, such as العربية, when the browser knows it and it differs from the English. */
function ownName(tag: string): string | null {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag);
    return name && name !== tag && name !== languageName(tag) ? name : null;
  } catch {
    return null;
  }
}

const direction = (tag: string) => (isRightToLeft(tag) ? 'rtl' : 'ltr');

export function wordsGrid(options: WordsGridOptions): WordsGrid {
  const { el, designer } = options;
  /** Words in their language, running its way; the cell around them keeps the grid's direction, so its lines and its place hold. */
  const inLanguage = (tag: string, text: string) => el('div', { class: 'fd-words-text', lang: tag, dir: direction(tag) }, text);
  const head = el('thead');
  const rows = el('tbody');
  const none = el('p', { class: 'fd-words-none', hidden: '' }, 'Every word is translated in every language.');
  // A region the keyboard can scroll (WCAG 2.1.1): wide grids scroll sideways, and a grid of the page's words alone has nothing to focus.
  const element = el('div', { class: 'fd-words-scroll', role: 'region', 'aria-label': 'Words and their translations', tabindex: '0' }, el('table', { class: 'fd-words-table fd-words-grid' }, head, rows), none);

  const staleHead = el('thead');
  const staleRows = el('tbody');
  const removeAll = el('button', { type: 'button', class: 'fd-button' }, 'Remove all');
  removeAll.addEventListener('click', () => designer.forgetWords(staleWords(designer.getPage())));
  const stale = el(
    'section',
    { class: 'fd-words-stale', 'aria-labelledby': 'fd-words-stale-title', hidden: '' },
    el(
      'div',
      { class: 'fd-words-stale-head' },
      el('h3', { id: 'fd-words-stale-title', class: 'fd-words-stale-title' }, 'No longer on the page'),
      el('p', { class: 'fd-words-stale-note' }, 'Translations kept for words the page no longer shows.'),
      removeAll
    ),
    el('div', { class: 'fd-words-scroll', role: 'region', 'aria-label': 'Translations no longer on the page', tabindex: '0' }, el('table', { class: 'fd-words-table fd-words-stale-grid' }, staleHead, staleRows))
  );

  /** Cells by language and word, kept from one drawing to the next so the one typed in keeps its focus. */
  const cells = new Map<string, HTMLTextAreaElement>();
  /** What each cell last kept, as typed: a cell being typed in shows its own words, unless they changed elsewhere, by an undo. */
  const sent = new WeakMap<HTMLTextAreaElement, string>();
  const progress = new Map<string, { th: HTMLElement; bar: HTMLElement; count: HTMLElement }>();
  let shape = '';
  let staleShape = '';
  let onlyMissing = false;

  function cellFor(tag: string, word: string): HTMLTextAreaElement {
    const key = `${tag}\n${word}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = el('textarea', { class: 'fd-words-cell', rows: '1', lang: tag, dir: direction(tag), 'data-lang': tag, 'data-word': word, 'aria-label': `${languageName(tag)} for “${word}”` });
      const typed = cell;
      typed.addEventListener('input', () => {
        sent.set(typed, typed.value.trim() ? typed.value : '');
        designer.setTranslation(tag, word, typed.value);
      });
      cells.set(key, cell);
    }
    return cell;
  }

  function drawHead(page: Page, languages: string[]) {
    const own = pageLanguage(page);
    progress.clear();
    const columns = languages.map((tag) => {
      const remove = el('button', { type: 'button', class: 'fd-icon-button fd-icon-danger fd-words-remove', 'aria-label': `Remove ${languageName(tag)}`, title: `Remove ${languageName(tag)}` }, '×');
      remove.addEventListener('click', () => options.onRemove(tag));
      const native = ownName(tag);
      const bar = el('span');
      const count = el('span', { class: 'fd-words-count' });
      const th = el(
        'th',
        { scope: 'col' },
        el('div', { class: 'fd-words-head' }, el('span', { class: 'fd-words-lang' }, languageName(tag)), ...(native ? [el('span', { class: 'fd-words-native', lang: tag, dir: direction(tag) }, native)] : []), remove),
        el('div', { class: 'fd-words-progress' }, el('span', { class: 'fd-words-meter', 'aria-hidden': 'true' }, bar), count)
      );
      progress.set(tag, { th, bar, count });
      return th;
    });
    const first = el(
      'th',
      { scope: 'col', 'aria-label': `${languageName(own)}, the page’s own words` },
      el('div', { class: 'fd-words-head' }, el('span', { class: 'fd-words-lang' }, languageName(own))),
      el('div', { class: 'fd-words-own' }, 'The page’s own words')
    );
    head.replaceChildren(el('tr', {}, first, ...columns));
  }

  function drawRows(page: Page, words: readonly string[], languages: string[]) {
    const own = pageLanguage(page);
    const live = new Set<string>();
    rows.replaceChildren(
      ...words.map((word) => {
        const tds = languages.map((tag, col) => {
          live.add(`${tag}\n${word}`);
          const cell = cellFor(tag, word);
          cell.dataset['col'] = String(col);
          return el('td', {}, cell);
        });
        return el('tr', { 'data-word': word }, el('th', { scope: 'row', class: 'fd-words-source' }, inLanguage(own, word)), ...tds);
      })
    );
    for (const key of [...cells.keys()]) if (!live.has(key)) cells.delete(key);
  }

  /** Rows every language has translated, out of sight while only the missing words show. */
  function filter(page: Page) {
    const languages = languagesOf(page);
    let shown = 0;
    for (const tr of rows.children as HTMLCollectionOf<HTMLTableRowElement>) {
      const word = tr.dataset['word'] as string;
      tr.hidden = onlyMissing && languages.length > 0 && languages.every((tag) => !!page.translations?.[tag]?.[word]);
      if (!tr.hidden) shown++;
    }
    none.hidden = shown > 0 || !rows.children.length;
  }

  function drawStale(page: Page) {
    const words = staleWords(page);
    const languages = languagesOf(page).filter((tag) => words.some((word) => page.translations?.[tag]?.[word]));
    const key = JSON.stringify(words.map((word) => [word, ...languages.map((tag) => page.translations?.[tag]?.[word] ?? '')]));
    stale.hidden = !words.length;
    if (key === staleShape) return;
    staleShape = key;
    staleHead.replaceChildren(el('tr', {}, el('th', { scope: 'col' }, 'Words'), ...languages.map((tag) => el('th', { scope: 'col' }, languageName(tag))), el('th', { scope: 'col', class: 'fd-words-gone-remove' }, el('span', { class: 'fd-sr-only' }, 'Remove'))));
    staleRows.replaceChildren(
      ...words.map((word) => {
        const remove = el('button', { type: 'button', class: 'fd-icon-button fd-icon-danger', 'aria-label': `Remove the translations of “${word}”`, title: 'Remove its translations' }, '×');
        remove.addEventListener('click', () => designer.forgetWords([word]));
        return el(
          'tr',
          {},
          el('th', { scope: 'row', class: 'fd-words-source' }, inLanguage(pageLanguage(page), word)),
          ...languages.map((tag) => el('td', { class: 'fd-words-gone' }, inLanguage(tag, page.translations?.[tag]?.[word] ?? ''))),
          el('td', { class: 'fd-words-gone-remove' }, remove)
        );
      })
    );
  }

  // ---- like a sheet: Enter and the arrows move between cells ----------------
  /** The cell `rowsBy` rows down and `colsBy` columns along, among the rows on show; the caret at the end of its words. */
  function move(from: HTMLTextAreaElement, rowsBy: number, colsBy: number): boolean {
    const shown = [...rows.children].filter((tr) => !(tr as HTMLElement).hidden);
    const at = shown.indexOf(from.closest('tr') as HTMLElement);
    const target = shown[at + rowsBy]?.querySelectorAll('textarea')[Number(from.dataset['col']) + colsBy];
    if (!target) return false;
    target.focus();
    target.setSelectionRange(target.value.length, target.value.length);
    return true;
  }
  rows.addEventListener('keydown', (event) => {
    const cell = event.target as HTMLTextAreaElement;
    if (!cell.matches('textarea') || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const { key } = event;
    const caret = cell.selectionStart === cell.selectionEnd ? cell.selectionStart : -1;
    const rtl = cell.getAttribute('dir') === 'rtl';
    // The visual ends of the words: right to left, the end of the words is on the left.
    const atLeft = caret === (rtl ? cell.value.length : 0);
    const atRight = caret === (rtl ? 0 : cell.value.length);
    let by: [number, number] | null = null;
    if (key === 'Enter') by = [event.shiftKey ? -1 : 1, 0];
    else if (event.shiftKey) return;
    else if (key === 'ArrowDown' || key === 'ArrowUp') by = [key === 'ArrowDown' ? 1 : -1, 0];
    else if (key === 'ArrowLeft' && atLeft) by = [0, -1];
    else if (key === 'ArrowRight' && atRight) by = [0, 1];
    if (!by) return;
    // Enter never breaks a line, even in the last row.
    if (move(cell, ...by) || key === 'Enter') event.preventDefault();
  });

  return {
    element,
    stale,
    update(page) {
      const words = wordsOf(page);
      const languages = languagesOf(page);
      const next = JSON.stringify([pageLanguage(page), words, languages]);
      if (next !== shape) {
        shape = next;
        drawHead(page, languages);
        drawRows(page, words, languages);
        filter(page);
      }
      for (const [key, cell] of cells) {
        const [tag, word] = key.split('\n');
        const text = page.translations?.[tag]?.[word] ?? '';
        // Written only when it changes: a grid of every word is brought up to date at each key typed in it.
        if ((cell.ownerDocument.activeElement !== cell || text !== (sent.get(cell) ?? text)) && cell.value !== text) cell.value = text;
        if (cell.hasAttribute('data-empty') !== !text) cell.toggleAttribute('data-empty', !text);
      }
      for (const [tag, { th, bar, count }] of progress) {
        const { done, total } = translationProgress(page, tag);
        const said = `${languageName(tag)}, ${done} of ${total} translated`;
        if (th.getAttribute('aria-label') !== said) th.setAttribute('aria-label', said);
        if (count.textContent !== `${done} of ${total}`) count.textContent = `${done} of ${total}`;
        bar.style.width = `${total ? (done / total) * 100 : 0}%`;
      }
      drawStale(page);
    },
    setOnlyMissing(on) {
      onlyMissing = on;
      filter(designer.getPage());
    },
    focusLanguage(tag) {
      const first = rows.querySelector<HTMLTextAreaElement>(`tr:not([hidden]) textarea[data-lang="${tag}"]`);
      first?.focus();
    },
  };
}
