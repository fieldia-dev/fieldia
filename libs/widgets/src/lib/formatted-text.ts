import { LINK_URL, MESSAGES, PICTURE_URL, safeUrl, webAddress, type Locale } from '@fieldia/core';
import { drawIcon, type IconSet } from './icons';
import { fillIn, maker } from './kind-parts';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { htmlToMarkdown, markdownLoses, markdownToHtml } from './markdown';
import { CHOOSING, EMOJI, HIGHLIGHTS, MARKDOWN_TOOLS, RICH_TOOLS, TEXT_COLOURS, TEXT_SIZES, TOGGLES, chevron, moreIcon, swatch, toolIcon, toolLabel, type TextTool } from './text-tools';
import { textMenu, type MenuChoice, type TextMenu } from './text-menu';
import { linkAddress, sanitizeHtml } from './sanitize';
import { givenHtml, heldHtml, restyle, showHtml, wearStyles } from './style-attributes';
import { copyHtml, keepCells, pasteHtml } from './pasted-html';
import { PICK_COLUMNS, cellAt, cellsInOrder, editTable, hasHeader, headedTables, markdownTable, newTable, pickerChoices, placeOf, tableGrid, tableHeight, tableSize, tableWidth, type TableEdit } from './rich-table';
import { installEditorStyles } from './styles-editor';

/**
 * A formatted text's editor, on its own: the rich editor (words formatted in
 * place, the browser's own editing, no library) or the Markdown one (a box of
 * Markdown, a hint, a preview), each with its toolbar, and a link under it to
 * switch between them. The html field draws it, and so does a conversation's
 * comment box (`formattedText(doc, options)`).
 *
 * Whatever it holds is handed on as clean HTML (`sanitizeHtml`): Markdown is
 * turned into HTML as it is typed, and HTML into Markdown to edit it.
 *
 * Its toolbar is one Tab stop; the arrow keys move along it, mirrored right to
 * left. Tools that find no room go under "…", a menu. Every tool is a named
 * button with a tooltip; none looks pressed-out: Remove link with no link
 * under the cursor says so.
 *
 * What is pasted from Word, Excel, Google Docs or a page is put in plain
 * (`pasteHtml`): its words, marks, links, lists, headings and tables, without
 * the source's fonts and colours. Tables (rich-table.ts): the table tool puts
 * one in at a size picked on its grid, or — with the caret in one — adds and
 * takes away rows and columns and sets its header row. In a table, Tab goes
 * to the next cell (past the last, a new row) and Escape out of it, said once
 * as the caret first comes in.
 */

export interface TextSuggestion {
  id: string | number;
  label: string;
}

/** A kind of record linked in the text by a key: "#" for a work item, "!" for a pull request. */
export interface TextReference {
  key: string;
  label: string;
  icon?: string;
  /** The model the record is of, kept on the link (`data-model`). */
  model?: string;
  search(query: string): Promise<TextSuggestion[]>;
}

export type TextEditor = 'rich' | 'markdown';

export interface FormattedTextOptions {
  /** The id of the box typed in, which the field's label points at. */
  id?: string;
  /** What names the box: an element's id, or words. */
  labelledBy?: string;
  label?: string;
  placeholder?: string;
  labels?: WidgetLabels;
  /** The page's language, for counts in words ("1 row by 3 columns"). */
  locale?: string;
  icons?: IconSet;
  editor?: TextEditor;
  /** The tools of the editor it starts in; the other editor has its own set. */
  tools?: readonly TextTool[];
  /** When the rich editor shows its toolbar: always, while it is worked in, or never. */
  toolbar?: 'always' | 'focus' | 'never';
  toolbarAt?: 'top' | 'bottom';
  /** A link under the box that switches between the editors: shown while it is worked in, or (`always`) at rest too. */
  switchEditor?: boolean | 'always';
  mention?: { search(query: string): Promise<TextSuggestion[]> };
  references?: readonly TextReference[];
  /** What it holds after each change made in it, as clean HTML; null when it is empty. */
  onInput?(html: string | null): void;
  /** A key pressed in the box before the editor acts on it: true when the caller took it. */
  onKey?(event: KeyboardEvent): boolean;
  /** The editor switched to, by the link. */
  onSwitch?(editor: TextEditor): void;
}

export interface FormattedText {
  readonly element: HTMLElement;
  /** The box typed in: the rich text, or the Markdown. */
  input(): HTMLElement;
  editor(): TextEditor;
  value(): string | null;
  /** Show this text. While it is being typed, the same text leaves the box alone. */
  setValue(html: string | null): void;
  /** Switch editors; from rich to Markdown, ask first when formatting would be lost (`ask`). */
  setEditor(editor: TextEditor, ask?: boolean): void;
  setReadonly(readonly: boolean): void;
  focus(): void;
  /** Words under the box for a moment, read out too. */
  say(text: string): void;
  destroy(): void;
}

let editors = 0;

/** A text that reads as nothing: no words, no picture, no list. */
const isEmpty = (html: string) => !html.replace(/<br\s*\/?>|<\/?(p|div|span)>|&nbsp;|\s/gi, '');

export function formattedText(doc: Document, options: FormattedTextOptions = {}): FormattedText {
  installEditorStyles(doc);
  const make = maker(doc);
  const labels = options.labels ?? WIDGET_LABELS.en;
  const n = ++editors;
  const references = options.references ?? [];
  const toolbarWhen = options.toolbar ?? 'always';
  let editor: TextEditor = options.editor ?? 'rich';
  let readonly = false;
  /** The last HTML handed on or shown: the same coming back leaves the box as it is. */
  let last: string | null = null;

  const element = make('div', { class: 'fd-text', 'data-editor': editor, 'data-toolbar': toolbarWhen, 'data-bar-at': options.toolbarAt ?? (toolbarWhen === 'focus' ? 'bottom' : 'top') });
  if (options.switchEditor === 'always') element.setAttribute('data-switch', 'always');
  const name = (box: HTMLElement) => {
    if (options.labelledBy) box.setAttribute('aria-labelledby', options.labelledBy);
    else if (options.label) box.setAttribute('aria-label', options.label);
  };

  // ---- the rich editor --------------------------------------------------------------
  const area = make('div', { class: 'fd-text-area', role: 'textbox', 'aria-multiline': 'true', contenteditable: 'true', id: editor === 'rich' ? options.id : undefined });
  name(area);
  if (options.placeholder) {
    area.setAttribute('data-placeholder', options.placeholder);
    area.setAttribute('aria-placeholder', options.placeholder);
  }
  const address = make('input', { class: 'fd-input', type: 'url', placeholder: 'https://', 'aria-label': labels.linkAddress });
  const applyLink = make('button', { type: 'button', class: 'fd-button fd-link-apply' }, labels.applyLink);
  const linkRow = make('div', { class: 'fd-link-row', hidden: '' }, address, applyLink);
  const richBox = make('div', { class: 'fd-text-box' });

  // ---- the Markdown editor --------------------------------------------------------------
  const markdown = make('textarea', { class: 'fd-md-input', rows: '3', spellcheck: 'true', id: editor === 'markdown' ? options.id : undefined });
  name(markdown);
  if (options.placeholder) markdown.placeholder = options.placeholder;
  const preview = make('div', { class: 'fd-md-preview', hidden: '', tabindex: '0', role: 'document' });
  name(preview);
  const info = drawIcon(doc, 'info');
  const hint = make('p', { class: 'fd-md-hint', id: `fd-md-hint-${n}` }, ...(info ? [info] : []), make('span', { class: 'fd-md-supported' }, labels.markdownSupported), ` ${labels.pasteOrSelect}`);
  markdown.setAttribute('aria-describedby', hint.id);
  const previewSwitch = make('button', { type: 'button', role: 'switch', class: 'fd-md-preview-switch', 'aria-checked': 'false' }, make('span', { class: 'fd-md-track', 'aria-hidden': 'true' }), make('span', {}, labels.preview));
  const mdRow = make('div', { class: 'fd-md-row' });
  const mdCard = make('div', { class: 'fd-md-card' }, markdown, preview, hint, mdRow);

  // ---- under the box --------------------------------------------------------------------
  const said = make('p', { class: 'fd-text-say', role: 'status', 'aria-live': 'polite' });
  const switcher = make('button', { type: 'button', class: 'fd-text-switch' });
  const under = make('div', { class: 'fd-text-under' }, said, ...(options.switchEditor ? [switcher] : []));
  const askWords = make('span', {}, labels.formattingLost);
  const askYes = make('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.switchAnyway);
  const askNo = make('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.cancel);
  const ask = make('div', { class: 'fd-text-ask', role: 'group', 'aria-label': labels.switchToMarkdown, hidden: '' }, askWords, askYes, askNo);
  const suggest = make('ul', { class: 'fd-text-suggest', role: 'listbox', id: `fd-text-suggest-${n}`, hidden: '', 'aria-label': labels.search });
  element.append(richBox, mdCard, under, ask, suggest);

  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  /** Words that stay their while as the person types on (the keys a table takes), where others go at the next key. */
  let lasting = false;
  function say(text: string, stays = false) {
    said.textContent = '';
    said.textContent = text;
    lasting = stays && !!text;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      said.textContent = '';
      lasting = false;
    }, 6000);
  }

  // ---- values ---------------------------------------------------------------------------
  function emit() {
    // What the browser's editing wrote as a style (an alignment, a colour), shown under a strict policy too.
    if (editor === 'rich') restyle(area);
    const html = editor === 'rich' ? sanitizeHtml(area.innerHTML, doc) : sanitizeHtml(markdownToHtml(markdown.value), doc);
    const value = isEmpty(html) ? null : html;
    area.classList.toggle('fd-blank', editor === 'rich' && !area.textContent?.trim() && !area.querySelector('img, li, table'));
    if (value === last) return;
    last = value;
    options.onInput?.(value);
  }
  function show(html: string | null) {
    // A table's header row in its head, as it shows and prints, though the value holds it among the rows.
    const clean = html ? headedTables(sanitizeHtml(html, doc), doc) : '';
    if (editor === 'rich') {
      if (area.innerHTML !== clean) showHtml(area, clean);
      area.classList.toggle('fd-blank', !area.textContent?.trim() && !area.querySelector('img, li, table'));
    } else {
      const text = htmlToMarkdown(clean, doc);
      if (markdown.value !== text) markdown.value = text;
      if (previewSwitch.getAttribute('aria-checked') === 'true') showHtml(preview, clean);
    }
  }

  // ---- the selection, kept for the tools ----------------------------------------------------
  let lastRange: Range | null = null;
  const restore = () => {
    area.focus();
    const selection = doc.getSelection();
    if (lastRange && selection) {
      selection.removeAllRanges();
      selection.addRange(lastRange);
    }
  };
  const exec = (command: string, value?: string) => {
    restore();
    doc.execCommand?.(command, false, value);
    emit();
  };
  const selectedLink = (): HTMLAnchorElement | null => {
    const node = lastRange?.commonAncestorContainer ?? doc.getSelection()?.anchorNode ?? null;
    const at = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null);
    const link = at?.closest?.('a');
    return link && area.contains(link) ? link : null;
  };

  // ---- Markdown edits ------------------------------------------------------------------
  /** Marks round the selection, or round a word to type when nothing is selected. */
  function wrapMarkdown(before: string, after = before, empty = '') {
    const [start, end] = [markdown.selectionStart, markdown.selectionEnd];
    const picked = markdown.value.slice(start, end) || empty;
    markdown.setRangeText(`${before}${picked}${after}`, start, end, 'end');
    markdown.setSelectionRange(start + before.length, start + before.length + picked.length);
    markdown.focus();
    emit();
  }
  /** A mark at the start of each line selected: a list, a checklist, a heading. */
  function prefixMarkdown(mark: (line: number) => string) {
    const value = markdown.value;
    const start = value.lastIndexOf('\n', markdown.selectionStart - 1) + 1;
    const endAt = value.indexOf('\n', markdown.selectionEnd);
    const end = endAt === -1 ? value.length : endAt;
    const lines = value.slice(start, end).split('\n').map((line, i) => mark(i) + line.replace(/^(#{1,4} |[-*+] (\[[ xX]\] )?|\d+\. )/, ''));
    markdown.setRangeText(lines.join('\n'), start, end, 'end');
    markdown.focus();
    emit();
  }
  function insertMarkdown(text: string) {
    markdown.setRangeText(text, markdown.selectionStart, markdown.selectionEnd, 'end');
    markdown.focus();
    emit();
  }

  // ---- pictures ---------------------------------------------------------------------------
  const picker = make('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: '', tabindex: '-1', 'aria-hidden': 'true' });
  element.append(picker);
  const MAX_PICTURE = 2 * 1024 * 1024;
  /** Counted each time the box is given other text from outside (another record's): a picture read meanwhile goes nowhere. */
  let given = 0;
  function insertPicture(file: File) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.size > MAX_PICTURE) return;
    const reader = new FileReader();
    const asked = given;
    reader.addEventListener('load', () => {
      if (asked !== given) return;
      const src = String(reader.result);
      if (editor === 'rich') {
        restore();
        const img = make('img', { src: safeUrl(src, PICTURE_URL), alt: file.name });
        doc.execCommand?.('insertHTML', false, img.outerHTML);
        emit();
      } else insertMarkdown(`![${file.name.replace(/[[\]]/g, '')}](${src})`);
    });
    reader.readAsDataURL(file);
  }
  picker.addEventListener('change', () => {
    for (const file of picker.files ?? []) insertPicture(file);
    picker.value = '';
  });
  markdown.addEventListener('paste', (event) => {
    const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    files.forEach(insertPicture);
  });

  // ---- tables ---------------------------------------------------------------------------------
  /** The cell where the caret is (or was, as a tool is pressed), in a table of this text. */
  const caretCell = (live = false): HTMLTableCellElement | null => {
    const node = (live ? null : lastRange?.startContainer) ?? doc.getSelection()?.anchorNode ?? null;
    const at = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
    const cell = at?.closest?.('td, th') as HTMLTableCellElement | null;
    return cell && area.contains(cell) ? cell : null;
  };
  /** The caret into a cell: its words selected, as Tab selects them in a word processor, or at its start. */
  function intoCell(cell: Element, whole = true) {
    const range = doc.createRange();
    range.selectNodeContents(cell);
    if (!whole || !cell.textContent?.trim()) range.collapse(true);
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastRange = range.cloneRange();
  }
  /** A table put back changed (or taken away) as one step the browser's Undo takes back; the caret into its cell `at`. */
  function replaceTable(table: HTMLTableElement, next: HTMLTableElement | null, at?: [number, number]) {
    const index = [...area.querySelectorAll('table')].indexOf(table);
    area.focus();
    const range = doc.createRange();
    range.selectNode(table);
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Its cells' looks held as the browser's editing reads it, then put on through their style objects: a strict policy
    // refuses a style attribute read as HTML (style-attributes.ts).
    doc.execCommand?.(next ? 'insertHTML' : 'delete', false, next ? heldHtml(next.outerHTML) : undefined);
    const now = next ? (area.querySelectorAll('table')[index] as HTMLTableElement | undefined) : undefined;
    if (now) wearStyles(now);
    if (now && next) keepCells(now, next);
    const cell = now && at ? cellAt(now, at) : null;
    if (cell) intoCell(cell, false);
    emit();
  }
  /**
   * The table and cell at a place (its table's among the text's, the cell's row and column): a menu's choice acts on
   * the place the caret was as it opened, found again as it is pressed, whatever the text was drawn as meanwhile.
   */
  type Place = { index: number; at: [number, number] };
  const placeNow = (): Place | null => {
    const cell = caretCell();
    const table = cell?.closest('table');
    return cell && table ? { index: [...area.querySelectorAll('table')].indexOf(table), at: placeOf(tableGrid(table), cell) } : null;
  };
  function editAt(place: Place, edit: TableEdit | null, said: string) {
    const table = area.querySelectorAll('table')[place.index] as HTMLTableElement | undefined;
    const cell = table && cellAt(table, place.at);
    if (!table || !cell) return;
    const done = edit ? editTable(table, cell, edit) : null;
    replaceTable(table, done?.table ?? null, done?.at);
    say(done ? said : labels.tableDeleted);
  }
  /** What may be done to the table the caret is in: what would leave no row or column is left out (Delete table is there). */
  function tableChoices(): MenuChoice[] {
    const place = placeNow();
    const table = place && (area.querySelectorAll('table')[place.index] as HTMLTableElement);
    if (!place || !table) return [];
    // Left and right as the table is drawn: right to left, left is after.
    const rtl = getComputedStyle(table).direction === 'rtl';
    const choice = (label: string, edit: TableEdit | null, said = '') => ({ label, run: () => editAt(place, edit, said) });
    return [
      choice(labels.tableRowAbove, 'rowAbove', labels.tableRowAdded),
      choice(labels.tableRowBelow, 'rowBelow', labels.tableRowAdded),
      choice(labels.tableColumnLeft, rtl ? 'columnAfter' : 'columnBefore', labels.tableColumnAdded),
      choice(labels.tableColumnRight, rtl ? 'columnBefore' : 'columnAfter', labels.tableColumnAdded),
      ...(tableHeight(table) > 1 ? [choice(labels.tableDeleteRow, 'deleteRow', labels.tableRowDeleted)] : []),
      ...(tableWidth(table) > 1 ? [choice(labels.tableDeleteColumn, 'deleteColumn', labels.tableColumnDeleted)] : []),
      { ...choice(labels.tableHeaderRow, 'header'), checked: hasHeader(table), toggle: true },
      choice(labels.tableDelete, null),
    ];
  }
  /** A table of empty cells where the caret is, its header row on, the caret in its first cell; a line to write on after it. */
  function insertTable(rows: number, columns: number) {
    if (editor === 'markdown') {
      const before = markdown.value.slice(0, markdown.selectionStart);
      const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      return insertMarkdown(`${lead}${markdownTable(rows, columns, (n) => fillIn(labels.tableColumn, { n }))}\n\n`);
    }
    restore();
    const had = new Set(area.querySelectorAll('table'));
    doc.execCommand?.('insertHTML', false, newTable(doc, rows, columns).outerHTML);
    const added = [...area.querySelectorAll('table')].find((table) => !had.has(table));
    if (added && !added.nextSibling) added.after(make('p', {}, make('br')));
    const first = added?.rows[0]?.cells[0];
    if (first) intoCell(first, false);
    emit();
  }
  /** The table tool's menus, from its button or "…": its size picked on a grid, or what to do to the table the caret is in. */
  const tableMenus = new Map<HTMLElement, { pick: TextMenu; act: TextMenu }>();
  function openTableMenu(anchor: HTMLElement, label: string, fromMore: boolean) {
    let menus = tableMenus.get(anchor);
    if (!menus) {
      const align = fromMore ? 'end' : 'start';
      const size = make('p', { class: 'fd-table-pick-size', 'aria-hidden': 'true' });
      const lit = (at: number, items: readonly HTMLElement[]) => {
        const [r, c] = [Math.floor(at / PICK_COLUMNS), at % PICK_COLUMNS];
        items.forEach((item, i) => item.classList.toggle('fd-on', Math.floor(i / PICK_COLUMNS) <= r && i % PICK_COLUMNS <= c));
        size.textContent = tableSize(labels, r + 1, c + 1, options.locale);
      };
      menus = {
        pick: textMenu(doc, anchor, { label: labels.tableInsert, align, grid: true, columns: PICK_COLUMNS, className: 'fd-table-pick', within: element, foot: size, onActive: lit }),
        act: textMenu(doc, anchor, { label, align, within: element }),
      };
      tableMenus.set(anchor, menus);
    }
    if (editor === 'rich' && caretCell()) menus.act.open(tableChoices());
    else menus.pick.open(pickerChoices(doc, labels, options.locale, insertTable));
  }
  /** Tab to the next cell (Shift+Tab, the one before), a new row past the last; Escape to the line after the table. */
  let toldKeys = false;
  function tableKey(event: KeyboardEvent): boolean {
    if (editor !== 'rich' || readonly || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || (event.key !== 'Tab' && event.key !== 'Escape')) return false;
    const cell = caretCell(true);
    const table = cell?.closest('table');
    if (!cell || !table) return false;
    event.preventDefault();
    if (event.key === 'Escape') {
      let after = table.nextSibling;
      if (!after) {
        after = make('p', {}, make('br'));
        table.after(after);
      }
      const range = doc.createRange();
      range.setStart(after, 0);
      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    }
    const cells = cellsInOrder(table);
    const i = cells.indexOf(cell);
    if (event.shiftKey) {
      if (i > 0) intoCell(cells[i - 1]);
    } else if (i < cells.length - 1) intoCell(cells[i + 1]);
    else {
      // Past the last cell, a row of its own, as a table of lines adds a line.
      const done = editTable(table, cell, 'rowBelow');
      if (done) replaceTable(table, done.table, [done.at[0], 0]);
      say(labels.tableRowAdded);
    }
    return true;
  }
  area.addEventListener('paste', (event) => editor === 'rich' && !readonly && pasteHtml(event, doc, area) && emit());
  // What is copied or cut from it is marked as its own: pasted back here or in another, its colours and sizes stay.
  area.addEventListener('copy', (event) => editor === 'rich' && copyHtml(event, area, doc));
  area.addEventListener('cut', (event) => {
    if (editor !== 'rich' || readonly || !copyHtml(event, area, doc)) return;
    doc.execCommand?.('delete', false);
    emit();
  });

  // ---- the tools --------------------------------------------------------------------------------
  /** What a tool does when pressed, in the editor shown now. */
  function run(tool: TextTool, reference?: TextReference) {
    say('');
    if (editor === 'markdown' && previewSwitch.getAttribute('aria-checked') === 'true') setPreview(false);
    if (editor === 'markdown') return runMarkdown(tool, reference);
    switch (tool) {
      case 'bold': return exec('bold');
      case 'italic': return exec('italic');
      case 'underline': return exec('underline');
      case 'strike': return exec('strikeThrough');
      case 'bulletList': return exec('insertUnorderedList');
      case 'numberList': return exec('insertOrderedList');
      case 'outdent': return exec('outdent');
      case 'indent': return exec('indent');
      case 'clearFormatting': return exec('removeFormat');
      case 'code': {
        restore();
        const text = doc.getSelection()?.toString() || labels.code.toLowerCase();
        doc.execCommand?.('insertHTML', false, `<code>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)}</code>`);
        return emit();
      }
      case 'taskList': {
        exec('insertUnorderedList');
        const item = (doc.getSelection()?.anchorNode as Node | null)?.parentElement?.closest('li');
        if (item && area.contains(item)) item.setAttribute('data-task', 'open');
        return emit();
      }
      case 'image':
      case 'attach':
        return picker.click();
      case 'link':
        linkRow.hidden = false;
        address.value = selectedLink()?.getAttribute('href') ?? '';
        address.setAttribute('aria-invalid', 'false');
        return address.focus();
      case 'unlink': {
        const link = selectedLink();
        if (!link) return say(labels.cursorInLink);
        restore();
        const range = doc.createRange();
        range.selectNodeContents(link);
        const selection = doc.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        doc.execCommand?.('unlink', false);
        return emit();
      }
      case 'mention':
        return startSuggesting('@');
      case 'reference':
        return startSuggesting(reference?.key ?? '#');
      default:
        return;
    }
  }

  function runMarkdown(tool: TextTool, reference?: TextReference) {
    switch (tool) {
      case 'bold': return wrapMarkdown('**');
      case 'italic': return wrapMarkdown('*');
      case 'strike': return wrapMarkdown('~~');
      case 'code': return wrapMarkdown('`');
      case 'highlight': return wrapMarkdown('==');
      case 'link': {
        const start = markdown.selectionStart;
        const words = markdown.value.slice(start, markdown.selectionEnd) || labels.link.toLowerCase();
        markdown.setRangeText(`[${words}](https://)`, start, markdown.selectionEnd, 'end');
        // The address selected, to type over.
        markdown.setSelectionRange(start + words.length + 3, start + words.length + 11);
        markdown.focus();
        return emit();
      }
      case 'bulletList': return prefixMarkdown(() => '- ');
      case 'numberList': return prefixMarkdown((i) => `${i + 1}. `);
      case 'taskList': return prefixMarkdown(() => '- [ ] ');
      case 'image':
      case 'attach':
        return picker.click();
      case 'mention':
        return startSuggesting('@');
      case 'reference':
        return startSuggesting(reference?.key ?? '#');
      default:
        return;
    }
  }

  /** The choices of a tool that opens a list: colours, sizes, a heading's level, emoji. */
  function choicesOf(tool: TextTool): MenuChoice[] {
    const names = labels.colourNames.split('|');
    const md = editor === 'markdown';
    switch (tool) {
      case 'highlight':
        return HIGHLIGHTS.map(([at, value]) => ({ label: names[at], lead: swatch(doc, value), run: () => colour('hiliteColor', value ?? 'transparent') }));
      case 'colour':
        return TEXT_COLOURS.map(([at, value]) => ({ label: names[at], lead: swatch(doc, value), run: () => colour('foreColor', value ?? 'inherit') }));
      case 'size':
        return TEXT_SIZES.map((size) => ({ label: `${size}px`, run: () => resize(size) }));
      case 'heading':
        return [1, 2, 3].map((level) => ({ label: fillIn(labels.headingLevel, { n: level }), run: () => (md ? prefixMarkdown(() => `${'#'.repeat(level)} `) : exec('formatBlock', `<h${level}>`)) })).concat(md ? [] : [{ label: labels.paragraph, run: () => exec('formatBlock', '<p>') }]);
      case 'emoji':
        return EMOJI.map((emoji) => ({ label: emoji, run: () => (md ? insertMarkdown(emoji) : exec('insertText', emoji)) }));
      default:
        return [];
    }
  }

  /**
   * A colour, a highlight or a size the browser put on a bold or italic element, moved to a span inside it: the
   * stored text keeps them on spans alone.
   */
  function spanStyles() {
    for (const marked of [...area.querySelectorAll<HTMLElement>('[style]:not(span)')]) {
      const kept = (['color', 'background-color', 'font-size'] as const).filter((name) => marked.style.getPropertyValue(name));
      if (!kept.length) continue;
      const span = make('span');
      for (const name of kept) {
        span.style.setProperty(name, marked.style.getPropertyValue(name));
        marked.style.removeProperty(name);
      }
      span.append(...marked.childNodes);
      marked.append(span);
      if (!marked.getAttribute('style')?.trim()) marked.removeAttribute('style');
    }
  }
  const colour = (command: 'hiliteColor' | 'foreColor', value: string) => {
    restore();
    doc.execCommand?.('styleWithCSS', false, 'true');
    doc.execCommand?.(command, false, value);
    spanStyles();
    emit();
  };

  /** Words in one of the sizes a stored text keeps. */
  function resize(size: number) {
    restore();
    doc.execCommand?.('styleWithCSS', false, 'false');
    doc.execCommand?.('fontSize', false, '7');
    for (const font of [...area.querySelectorAll('font[size="7"]')]) {
      // Through its style object, never a style attribute: a strict Content-Security-Policy lets one be.
      const span = make('span', {}, ...font.childNodes);
      span.style.fontSize = `${size}px`;
      font.replaceWith(span);
    }
    for (const span of [...area.querySelectorAll<HTMLElement>('[style*="xxx-large"]')]) span.style.fontSize = `${size}px`;
    spanStyles();
    emit();
  }

  /** A tool's button, or the button of a reference kind; a tool with choices opens them. */
  interface Stop {
    tool: TextTool;
    label: string;
    button: HTMLButtonElement;
    menu?: ReturnType<typeof textMenu>;
    press(from: HTMLElement): void;
  }

  function stopsFor(list: readonly TextTool[]): Stop[] {
    const stops: Stop[] = [];
    for (const tool of list) {
      if (tool === 'mention' && !options.mention) continue;
      if (tool === 'unlink' && editor === 'markdown') continue;
      const kinds: (TextReference | undefined)[] = tool === 'reference' ? [...references] : [undefined];
      for (const reference of kinds) {
        const label = reference ? fillIn(labels.linkRecordNamed, { kind: kindWords(reference.label) }) : toolLabel(tool, labels);
        const choosing = CHOOSING.has(tool) && !(tool === 'highlight' && editor === 'markdown');
        // Emoji opens its list too, though its face alone says so: no chevron.
        const chevroned = choosing && tool !== 'emoji';
        const button = make('button', { type: 'button', class: `fd-text-tool${chevroned ? ' fd-text-tool-choice' : ''}`, 'data-tool': tool, 'aria-label': label, title: label, tabindex: '-1' }, toolIcon(doc, tool, options.icons, reference?.icon, editor));
        if (choosing) {
          if (chevroned) button.append(chevron(doc));
          button.setAttribute('aria-haspopup', 'menu');
          button.setAttribute('aria-expanded', 'false');
        }
        if (TOGGLES.has(tool) && editor === 'rich') button.setAttribute('aria-pressed', 'false');
        if (reference) button.setAttribute('data-key', reference.key);
        // The text keeps its selection when a tool is pressed.
        button.addEventListener('mousedown', (event) => event.preventDefault());
        const stop: Stop = {
          tool,
          label,
          button,
          press(from) {
            if (!choosing) return run(tool, reference);
            if (tool === 'table') return openTableMenu(from, label, from !== button);
            const menu = from === button ? (stop.menu ??= textMenu(doc, button, { label, grid: tool === 'emoji', className: tool === 'emoji' ? 'fd-text-emoji' : undefined, within: element })) : moreMenuFor(from, label, tool);
            menu.open(choicesOf(tool));
          },
        };
        button.addEventListener('click', () => stop.press(button));
        stops.push(stop);
      }
    }
    return stops;
  }

  /** The kind of record in a tool's name as a sentence has it: "Link work item". */
  function kindWords(kind: string): string {
    return /^[A-Z][a-z]/.test(kind) && labels === WIDGET_LABELS.en ? kind[0].toLowerCase() + kind.slice(1) : kind;
  }

  /** A tool's choices opened from "…": under that button, in place of the menu it came from. */
  const fromMore = new Map<TextTool, ReturnType<typeof textMenu>>();
  function moreMenuFor(more: HTMLElement, label: string, tool: TextTool) {
    let menu = fromMore.get(tool);
    if (!menu) {
      menu = textMenu(doc, more, { label, align: 'end', grid: tool === 'emoji', className: tool === 'emoji' ? 'fd-text-emoji' : undefined, within: element });
      fromMore.set(tool, menu);
    }
    return menu;
  }

  /** A toolbar of these tools: one Tab stop, the arrows along it, "…" for what has no room. */
  function toolbar(list: readonly TextTool[], extra: HTMLElement[] = []) {
    const bar = make('div', { class: 'fd-text-bar', role: 'toolbar', 'aria-label': labels.formatting });
    const stops = stopsFor(list);
    const more = make('button', { type: 'button', class: 'fd-text-tool fd-text-more', 'aria-label': labels.moreTools, title: labels.moreTools, tabindex: '-1', hidden: '' }, moreIcon(doc));
    more.addEventListener('mousedown', (event) => event.preventDefault());
    const moreMenu = textMenu(doc, more, { label: labels.moreTools, align: 'end', within: element });
    more.addEventListener('click', () =>
      moreMenu.open(stops.filter((stop) => stop.button.hidden).map((stop) => ({ label: stop.label, lead: toolIcon(doc, stop.tool, options.icons, stop.button.getAttribute('data-key') ? references.find((r) => r.key === stop.button.getAttribute('data-key'))?.icon : undefined, editor), run: () => stop.press(more) })))
    );
    bar.append(...stops.map((stop) => stop.button), more, ...extra);
    // One stop on Tab, the first tool; the rest, Preview too, by the arrows.
    for (const button of extra) if (button.matches('button')) button.tabIndex = -1;
    if (stops[0]) stops[0].button.tabIndex = 0;
    else if (extra[0]) extra[0].tabIndex = 0;
    const shown = () => [...stops.map((stop) => stop.button), more, ...extra.filter((e) => e.matches('button'))].filter((b) => !b.hidden) as HTMLElement[];
    bar.addEventListener('keydown', (event) => {
      const all = shown();
      const at = all.indexOf(doc.activeElement as HTMLElement);
      if (at < 0) return;
      const rtl = getComputedStyle(bar).direction === 'rtl';
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, Home: -at, End: all.length - 1 - at }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      const next = all[(at + step + all.length) % all.length];
      for (const b of all) b.tabIndex = b === next ? 0 : -1;
      next.focus();
    });
    /** As many tools as fit, in order; "…" holds the rest. */
    const fit = () => {
      // Out of sight (a toolbar shown only while the text is worked in), it is measured once it shows.
      if (!bar.clientWidth) return;
      for (const stop of stops) stop.button.hidden = false;
      more.hidden = true;
      const room = bar.clientWidth - parseFloat(getComputedStyle(bar).paddingInlineStart || '0') - parseFloat(getComputedStyle(bar).paddingInlineEnd || '0');
      const gap = parseFloat(getComputedStyle(bar).columnGap || '0') || 0;
      const widths = stops.map((stop) => stop.button.offsetWidth + gap);
      const others = extra.reduce((sum, e) => sum + e.offsetWidth + gap, 0);
      const total = widths.reduce((sum, w) => sum + w, 0) + others;
      if (total - gap <= room) return;
      more.hidden = false;
      let used = others + more.offsetWidth + gap;
      let count = 0;
      while (count < stops.length && used + widths[count] - gap <= room) used += widths[count++];
      stops.forEach((stop, i) => (stop.button.hidden = i >= count));
      // The Tab stop is a tool in sight.
      if (!shown().some((b) => b.tabIndex === 0)) (shown()[0] ?? more).tabIndex = 0;
    };
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fit());
    watcher?.observe(bar);
    // Each tool says whether the selection has its format; Unlink, with no link where the caret is, is drawn idle, its
    // tooltip saying why — still a button, and a press says it too: never greyed out without a reason.
    const reflect = () => {
      for (const stop of stops) {
        if (stop.tool === 'unlink') {
          const idle = !selectedLink();
          stop.button.toggleAttribute('data-idle', idle);
          stop.button.title = idle ? `${stop.label} — ${labels.cursorInLink}` : stop.label;
        }
        if (!stop.button.hasAttribute('aria-pressed')) continue;
        const command = stop.tool === 'strike' ? 'strikeThrough' : stop.tool;
        stop.button.setAttribute('aria-pressed', String(!!doc.queryCommandState?.(command)));
      }
    };
    return { bar, stops, fit, reflect, destroy: () => watcher?.disconnect() };
  }

  // ---- the two toolbars, built for the editor they belong to -------------------------------------
  let richBar: ReturnType<typeof toolbar> | null = null;
  let mdBar: ReturnType<typeof toolbar> | null = null;
  const richTools = () => (options.editor !== 'markdown' && options.tools ? options.tools : RICH_TOOLS);
  const mdTools = () => (options.editor === 'markdown' && options.tools ? options.tools : MARKDOWN_TOOLS);

  function drawRich() {
    if (!richBar && toolbarWhen !== 'never') {
      richBar = toolbar(richTools());
      // Its tools as the text is now: Unlink idle until the caret is in a link.
      richBar.reflect();
    }
    const parts: HTMLElement[] = [area, linkRow];
    if (richBar) {
      if (element.getAttribute('data-bar-at') === 'top') parts.unshift(richBar.bar);
      else parts.push(richBar.bar);
    }
    richBox.replaceChildren(...parts);
  }
  function drawMarkdown() {
    if (!mdBar) mdBar = toolbar(mdTools(), [previewSwitch]);
    mdRow.replaceChildren(mdBar.bar);
  }

  function setPreview(on: boolean) {
    previewSwitch.setAttribute('aria-checked', String(on));
    if (on) showHtml(preview, decorateLinks(sanitizeHtml(markdownToHtml(markdown.value), doc), doc));
    preview.style.minHeight = on ? `${markdown.offsetHeight}px` : '';
    markdown.hidden = on;
    preview.hidden = !on;
    (on ? preview : markdown).focus();
  }
  previewSwitch.addEventListener('click', () => setPreview(previewSwitch.getAttribute('aria-checked') !== 'true'));

  function setEditor(next: TextEditor, asking = false) {
    if (next === editor) return;
    if (next === 'markdown' && asking && last && markdownLoses(last, doc)) {
      ask.hidden = false;
      askNo.focus();
      return;
    }
    const value = last;
    editor = next;
    element.setAttribute('data-editor', editor);
    // The label points at the box typed in.
    if (options.id) {
      area.id = editor === 'rich' ? options.id : '';
      markdown.id = editor === 'markdown' ? options.id : '';
      if (!area.id) area.removeAttribute('id');
      if (!markdown.id) markdown.removeAttribute('id');
    }
    draw();
    show(value);
    options.onSwitch?.(editor);
  }
  askYes.addEventListener('click', () => {
    ask.hidden = true;
    setEditor('markdown');
    markdown.focus();
  });
  const keepEditor = () => {
    ask.hidden = true;
    switcher.focus();
  };
  askNo.addEventListener('click', keepEditor);
  ask.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    keepEditor();
  });
  switcher.addEventListener('click', () => {
    setEditor(editor === 'rich' ? 'markdown' : 'rich', true);
    if (ask.hidden) (editor === 'rich' ? area : markdown).focus();
  });

  function draw() {
    richBox.hidden = editor !== 'rich';
    mdCard.hidden = editor !== 'markdown';
    if (editor === 'rich') drawRich();
    else drawMarkdown();
    switcher.textContent = editor === 'rich' ? labels.switchToMarkdown : labels.switchToRich;
    (editor === 'rich' ? richBar : mdBar)?.fit();
  }

  // ---- the link row ----------------------------------------------------------------------------
  applyLink.addEventListener('click', () => {
    const url = safeUrl(linkAddress(address.value), ['http', 'https', 'mailto']);
    if (!url) {
      address.setAttribute('aria-invalid', 'true');
      // Said why, as a web address field says it (0.35.1: refused without a word).
      const messages = MESSAGES[(options.locale ?? 'en') as Locale] ?? MESSAGES.en;
      say(webAddress(address.value) === 'scheme' ? messages.urlScheme : messages.url, true);
      return;
    }
    address.setAttribute('aria-invalid', 'false');
    restore();
    if (doc.getSelection()?.isCollapsed) doc.execCommand?.('insertHTML', false, make('a', { href: safeUrl(url, LINK_URL) }, url).outerHTML);
    else doc.execCommand?.('createLink', false, url);
    linkRow.hidden = true;
    emit();
  });
  address.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLink.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      linkRow.hidden = true;
      restore();
    }
  });

  // ---- people and records, as they are typed after their key ----------------------------------------
  const keys = [...(options.mention ? ['@'] : []), ...references.map((r) => r.key)];
  let found: TextSuggestion[] = [];
  let active = 0;
  let asking = 0;
  let suggesting: { key: string; start: number; node?: Text } | null = null;

  const closeSuggestions = () => {
    suggest.hidden = true;
    found = [];
    suggesting = null;
    for (const box of [area, markdown]) box.removeAttribute('aria-activedescendant');
  };
  function startSuggesting(key: string) {
    if (editor === 'rich') {
      restore();
      doc.execCommand?.('insertText', false, key);
    } else insertMarkdown(key);
    void lookUp();
  }
  /** What is typed after a key, up to the cursor, in the box shown. */
  function typed(): { key: string; query: string; start: number; node?: Text } | null {
    if (!keys.length) return null;
    const pattern = new RegExp(`(?:^|\\s)([${keys.map((k) => k.replace(/[\\\]^-]/g, '\\$&')).join('')}])([\\p{L}\\p{N}._-]*)$`, 'u');
    if (editor === 'markdown') {
      const before = markdown.value.slice(0, markdown.selectionStart);
      const match = pattern.exec(before);
      return match ? { key: match[1], query: match[2], start: before.length - match[2].length - 1 } : null;
    }
    const selection = doc.getSelection();
    const node = selection?.anchorNode;
    if (!selection?.isCollapsed || node?.nodeType !== Node.TEXT_NODE || !area.contains(node)) return null;
    const before = (node.textContent ?? '').slice(0, selection.anchorOffset);
    const match = pattern.exec(before);
    return match ? { key: match[1], query: match[2], start: before.length - match[2].length - 1, node: node as Text } : null;
  }
  async function lookUp() {
    const at = typed();
    if (!at) return closeSuggestions();
    const search = at.key === '@' && options.mention ? options.mention.search : references.find((r) => r.key === at.key)?.search;
    if (!search) return closeSuggestions();
    const mine = ++asking;
    const results = await search(at.query);
    if (mine !== asking) return;
    found = results.slice(0, 8);
    active = 0;
    suggesting = { key: at.key, start: at.start, node: at.node };
    drawSuggestions();
  }
  function drawSuggestions() {
    const box = editor === 'rich' ? area : markdown;
    suggest.replaceChildren(
      ...(found.length
        ? found.map((item, i) => {
            const option = make('li', { role: 'option', id: `${suggest.id}-${i}`, 'aria-selected': String(i === active) }, suggestionWords(item));
            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('click', () => pick(item));
            return option;
          })
        : [make('li', { class: 'fd-empty' }, labels.noResults)])
    );
    suggest.hidden = false;
    box.setAttribute('aria-controls', suggest.id);
    if (found.length) box.setAttribute('aria-activedescendant', `${suggest.id}-${active}`);
  }
  const suggestionWords = (item: TextSuggestion) => (suggesting?.key === '@' ? item.label : `${suggesting?.key ?? ''}${item.id} ${item.label}`);
  function pick(item: TextSuggestion) {
    const at = suggesting;
    if (!at) return;
    const reference = references.find((r) => r.key === at.key);
    const words = at.key === '@' ? `@${item.label}` : `${at.key}${item.id}`;
    if (editor === 'markdown') {
      markdown.setRangeText(`${words} `, at.start, markdown.selectionStart, 'end');
      closeSuggestions();
      markdown.focus();
      return emit();
    }
    const node = at.node;
    const selection = doc.getSelection();
    if (!node || !selection) return closeSuggestions();
    const range = doc.createRange();
    range.setStart(node, at.start);
    range.setEnd(node, Math.min(selection.anchorOffset, node.length));
    range.deleteContents();
    const mark = make('span', at.key === '@' ? { 'data-mention': String(item.id) } : { 'data-record': String(item.id), ...(reference?.model ? { 'data-model': reference.model } : {}) }, words);
    const space = doc.createTextNode(' ');
    range.insertNode(space);
    range.insertNode(mark);
    range.setStartAfter(space);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    closeSuggestions();
    area.focus();
    emit();
  }
  const suggestKeys = (event: KeyboardEvent) => {
    // A key an IME is composing with — the Enter that takes its word — is the IME's, never a pick.
    if (suggest.hidden || !found.length || event.isComposing || event.keyCode === 229) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
      drawSuggestions();
    } else if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === 'Tab') pick(found[active]);
    else if (event.key === 'Escape') closeSuggestions();
    else return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  // ---- typing --------------------------------------------------------------------------------
  for (const box of [area, markdown] as HTMLElement[]) {
    box.addEventListener('keydown', (event) => {
      if (suggestKeys(event)) return;
      if (tableKey(event)) return;
      if (options.onKey?.(event)) return;
    });
    box.addEventListener('input', () => {
      if (!lasting) say('');
      emit();
      void lookUp();
    });
  }
  // The keys a table takes said again once the person has left the text and comes back (its toolbar and menus are its).
  element.addEventListener('focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null)) toldKeys = false;
  });
  area.addEventListener('blur', () => {
    // What is shown is what was kept: anything unsafe typed or pasted is gone.
    // Shown as every value is (`showHtml`): its looks through style objects, which a strict policy lets be.
    if (editor === 'rich' && area.innerHTML !== (last ?? '') && last !== null) showHtml(area, last);
    setTimeout(() => {
      if (!element.contains(doc.activeElement)) closeSuggestions();
    });
  });
  // A checklist's box ticks and unticks at a press.
  area.addEventListener('click', (event) => {
    const item = (event.target as Element).closest?.('li[data-task]');
    if (!item || readonly) return;
    const box = item.getBoundingClientRect();
    const rtl = getComputedStyle(item).direction === 'rtl';
    const offset = rtl ? box.right - event.clientX : event.clientX - box.left;
    if (offset > 18) return;
    item.setAttribute('data-task', item.getAttribute('data-task') === 'done' ? 'open' : 'done');
    emit();
  });
  const reflect = () => {
    const selection = doc.getSelection();
    if (!selection?.rangeCount || !area.contains(selection.anchorNode)) return;
    lastRange = selection.getRangeAt(0).cloneRange();
    richBar?.reflect();
    // The keys a table takes, said once as the caret first comes into one while the text is worked in.
    if (!toldKeys && editor === 'rich' && !readonly && doc.activeElement === area && caretCell(true)) {
      toldKeys = true;
      say(labels.tableKeys, true);
    }
  };
  doc.addEventListener('selectionchange', reflect);

  draw();
  // Empty to start: its placeholder shows.
  show(null);

  return {
    element,
    input: () => (editor === 'rich' ? area : markdown),
    editor: () => editor,
    value: () => last,
    setValue(html) {
      const clean = html ? sanitizeHtml(html, doc) : null;
      const value = clean && !isEmpty(clean) ? clean : null;
      const typing = element.contains(doc.activeElement);
      if (value === last && typing) return;
      if (value !== last) given++;
      last = value;
      show(value);
    },
    setEditor,
    setReadonly(on) {
      readonly = on;
      area.setAttribute('contenteditable', String(!on));
      area.setAttribute('aria-readonly', String(on));
      markdown.readOnly = on;
      for (const bar of [richBar, mdBar]) if (bar) bar.bar.hidden = on;
      under.hidden = on;
      if (on) linkRow.hidden = true;
    },
    focus: () => (editor === 'rich' ? area : previewSwitch.getAttribute('aria-checked') === 'true' ? preview : markdown).focus(),
    say,
    destroy() {
      clearTimeout(sayTimer);
      doc.removeEventListener('selectionchange', reflect);
      richBar?.destroy();
      mdBar?.destroy();
    },
  };
}

/**
 * Links that leave the page, as drawn: opened in a tab of their own, an icon
 * after each saying so. The stored text keeps none of it.
 */
export function decorateLinks(html: string, doc: Document): string {
  // Its style attributes held while it is read, as a strict Content-Security-Policy needs (style-attributes.ts).
  const box = doc.createElement('template');
  box.innerHTML = heldHtml(html);
  for (const link of box.content.querySelectorAll('a[href]')) {
    if (!/^https?:/i.test(link.getAttribute('href') ?? '')) continue;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    const icon = drawIcon(doc, 'external');
    if (icon) {
      icon.classList.add('fd-external');
      link.after(icon);
    }
  }
  const out = doc.createElement('div');
  out.append(box.content);
  return givenHtml(out.innerHTML);
}
