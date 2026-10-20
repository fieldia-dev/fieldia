import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cellsInOrder, editTable, hasHeader, markdownTable, newTable, tableGrid, type TableEdit } from './rich-table';
import { htmlToMarkdown, markdownLoses, markdownToHtml } from './markdown';
import { sanitizeHtml } from './sanitize';
import { cleanPasted } from './pasted-html';
import { mountKind, press } from './test-kinds';

/**
 * Tables in a formatted text: one put in at a size picked on a grid, rows and columns added and taken away where the
 * caret is — a cell spanning several widened, narrowed or carried down, never split — a header row on and off, Tab
 * from cell to cell (a row added past the last), Escape out of the table, a table pasted kept plain, and Markdown both
 * ways.
 */

const table = (html: string) => {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box.querySelector('table') as HTMLTableElement;
};
/** A table's rows as the words of their cells, a span written after them ("Total:3" across three columns). */
const shape = (t: HTMLTableElement) =>
  [...t.rows].map((row) => [...row.cells].map((cell) => `${cell.tagName === 'TH' ? '#' : ''}${cell.textContent || '_'}${cell.colSpan > 1 ? `:${cell.colSpan}` : ''}${cell.rowSpan > 1 ? `v${cell.rowSpan}` : ''}`).join(' '));
const edit = (html: string, words: string, how: TableEdit) => {
  const t = table(html);
  const cell = [...t.querySelectorAll('td, th')].find((one) => one.textContent === words) as HTMLTableCellElement;
  const done = editTable(t, cell, how);
  // The table itself is left as it was: the change is a copy, put back by the editor in one step.
  expect(t.outerHTML).toBe(table(html).outerHTML);
  return done;
};

const PRICES =
  '<table><thead><tr><th>Service</th><th>Qty</th><th>Amount</th></tr></thead><tbody><tr><td>Design</td><td>2</td><td>3,000.00</td></tr><tr><td colspan="2">Total</td><td>3,000.00</td></tr></tbody></table>';
const DOWN = '<table><tbody><tr><td rowspan="2">Lot 1</td><td>a</td></tr><tr><td>b</td></tr><tr><td>Lot 2</td><td>c</td></tr></tbody></table>';

describe('a table’s rows and columns, where the caret is', () => {
  it('a row above or below, under the header row in the body, empty cells to write in', () => {
    const below = edit(PRICES, 'Qty', 'rowBelow');
    expect(shape(below!.table)).toEqual(['#Service #Qty #Amount', '_ _ _', 'Design 2 3,000.00', 'Total:2 3,000.00']);
    expect(below!.table.tBodies[0].rows[0].innerHTML).toBe('<td><br></td><td><br></td><td><br></td>');
    expect(below!.at).toEqual([1, 1]);
    expect(shape(edit(PRICES, 'Design', 'rowAbove')!.table)).toEqual(['#Service #Qty #Amount', '_ _ _', 'Design 2 3,000.00', 'Total:2 3,000.00']);
    // Above a header row, another header row.
    expect(shape(edit(PRICES, 'Service', 'rowAbove')!.table)).toEqual(['#_ #_ #_', '#Service #Qty #Amount', 'Design 2 3,000.00', 'Total:2 3,000.00']);
    expect(shape(edit(PRICES, 'Total', 'rowBelow')!.table)).toEqual(['#Service #Qty #Amount', 'Design 2 3,000.00', 'Total:2 3,000.00', '_ _ _']);
  });

  it('a column before or after; one spanning across the new column is widened', () => {
    const after = edit(PRICES, 'Service', 'columnAfter');
    expect(shape(after!.table)).toEqual(['#Service #_ #Qty #Amount', 'Design _ 2 3,000.00', 'Total:3 3,000.00']);
    expect(after!.at).toEqual([0, 1]);
    expect(shape(edit(PRICES, 'Amount', 'columnBefore')!.table)).toEqual(['#Service #Qty #_ #Amount', 'Design 2 _ 3,000.00', 'Total:2 _ 3,000.00']);
    expect(shape(edit(PRICES, 'Amount', 'columnAfter')!.table)).toEqual(['#Service #Qty #Amount #_', 'Design 2 3,000.00 _', 'Total:2 3,000.00 _']);
  });

  it('a row or column taken away; one spanning it narrowed; the last one takes the table', () => {
    expect(shape(edit(PRICES, 'Qty', 'deleteColumn')!.table)).toEqual(['#Service #Amount', 'Design 3,000.00', 'Total 3,000.00']);
    expect(shape(edit(PRICES, 'Design', 'deleteRow')!.table)).toEqual(['#Service #Qty #Amount', 'Total:2 3,000.00']);
    // The header row taken away: the table's head goes with it.
    const headless = edit(PRICES, 'Service', 'deleteRow')!.table;
    expect(headless.tHead).toBeNull();
    expect(edit('<table><tr><td>only</td><td>x</td></tr></table>', 'only', 'deleteRow')).toBeNull();
    expect(edit('<table><tr><td>only</td></tr><tr><td>x</td></tr></table>', 'only', 'deleteColumn')).toBeNull();
  });

  it('a cell running down several rows: taller with a row in it, carried down when its first row goes', () => {
    expect(shape(edit(DOWN, 'a', 'rowBelow')!.table)).toEqual(['Lot 1v3 a', '_', 'b', 'Lot 2 c']);
    expect(shape(edit(DOWN, 'b', 'rowBelow')!.table)).toEqual(['Lot 1v2 a', 'b', '_ _', 'Lot 2 c']);
    expect(shape(edit(DOWN, 'a', 'deleteRow')!.table)).toEqual(['Lot 1 b', 'Lot 2 c']);
    expect(shape(edit(DOWN, 'b', 'deleteRow')!.table)).toEqual(['Lot 1 a', 'Lot 2 c']);
    expect(shape(edit(DOWN, 'a', 'columnBefore')!.table)).toEqual(['Lot 1v2 _ a', '_ b', 'Lot 2 _ c']);
  });

  it('a header row on and off: the first row’s cells headers in the table’s head, or plain cells in its body', () => {
    const off = edit(PRICES, 'Design', 'header')!.table;
    expect(hasHeader(off)).toBe(false);
    expect(off.tHead).toBeNull();
    expect(shape(off)).toEqual(['Service Qty Amount', 'Design 2 3,000.00', 'Total:2 3,000.00']);
    const on = editTable(off, off.rows[0].cells[0], 'header')!.table;
    expect(on.tHead?.rows).toHaveLength(1);
    expect(shape(on)).toEqual(['#Service #Qty #Amount', 'Design 2 3,000.00', 'Total:2 3,000.00']);
    // A first row whose cell runs down stays in the body, its cells headers.
    const down = edit(DOWN, 'a', 'header')!.table;
    expect([down.tHead, shape(down)]).toEqual([null, ['#Lot 1v2 #a', 'b', 'Lot 2 c']]);
  });

  it('every cell once, as Tab reaches them; a new table with its header row', () => {
    expect(cellsInOrder(table(DOWN)).map((cell) => cell.textContent)).toEqual(['Lot 1', 'a', 'b', 'Lot 2', 'c']);
    expect(tableGrid(table(DOWN)).map((line) => line.map((cell) => cell.textContent))).toEqual([['Lot 1', 'a'], ['Lot 1', 'b'], ['Lot 2', 'c']]);
    expect(newTable(document, 2, 3).outerHTML).toBe('<table><thead><tr><th><br></th><th><br></th><th><br></th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>');
    expect(newTable(document, 1, 1).outerHTML).toBe('<table><thead><tr><th><br></th></tr></thead></table>');
  });
});

describe('tables in Markdown, both ways', () => {
  const MD = '| Service | Qty | Amount |\n| :--- | :---: | ---: |\n| Design \\| UX | 2 | 3,000.00 |\n| Build | 1 |';
  const HTML =
    '<table><thead><tr><th style="text-align: left;">Service</th><th style="text-align: center;">Qty</th><th style="text-align: right;">Amount</th></tr></thead>' +
    '<tbody><tr><td style="text-align: left;">Design | UX</td><td style="text-align: center;">2</td><td style="text-align: right;">3,000.00</td></tr>' +
    '<tr><td style="text-align: left;">Build</td><td style="text-align: center;">1</td><td style="text-align: right;"></td></tr></tbody></table>';

  it('reads a table as GitHub writes one: its header, its columns’ alignment, a pipe escaped in its words', () => {
    expect(markdownToHtml(`Fees:\n\n${MD}\n\nPaid monthly.`)).toBe(`<p>Fees:</p>${HTML}<p>Paid monthly.</p>`);
    // Straight after a paragraph's line, too; a line of dashes under words with no pipe is no table.
    expect(markdownToHtml(`Fees:\n${MD}`)).toBe(`<p>Fees:</p>${HTML}`);
    expect(markdownToHtml('a | b\n---')).toBe('<p>a | b\n---</p>');
  });

  it('writes a table back the same, and says nothing is lost', () => {
    expect(htmlToMarkdown(HTML)).toBe('| Service | Qty | Amount |\n| :--- | :---: | ---: |\n| Design \\| UX | 2 | 3,000.00 |\n| Build | 1 |  |');
    expect(markdownToHtml(htmlToMarkdown(HTML))).toBe(HTML);
    expect(markdownLoses(HTML)).toBe(false);
    expect(markdownLoses(sanitizeHtml(markdownToHtml(markdownTable(3, 2, (n) => `Column ${n}`))))).toBe(false);
  });

  it('asks first where Markdown cannot say the table as it is', () => {
    expect(markdownLoses(PRICES)).toBe(true); // a cell across two columns
    expect(markdownLoses('<table><tr><td>a</td></tr><tr><td>b</td></tr></table>')).toBe(true); // no header row
    expect(markdownLoses('<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>b<br>c</td></tr></tbody></table>')).toBe(true); // a line break in a cell
    expect(markdownLoses('<table><thead><tr><th>a</th></tr></thead><tbody><tr><td style="text-align: right;">1</td></tr></tbody></table>')).toBe(true); // a column aligned two ways
    expect(markdownLoses('<table dir="rtl"><thead><tr><th>a</th></tr></thead></table>')).toBe(true);
    // Said as near as Markdown can: the cell across two its words, the header the first row.
    expect(htmlToMarkdown(PRICES)).toBe('| Service | Qty | Amount |\n| --- | --- | --- |\n| Design | 2 | 3,000.00 |\n| Total | 3,000.00 |  |');
  });

  it('a Markdown table to start from: its columns named, empty rows under them', () => {
    expect(markdownTable(3, 2, (n) => `Column ${n}`)).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|   |   |\n|   |   |');
  });
});

// ---- the editor ------------------------------------------------------------------------------------------------

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/clipboard', `${name}.html`), 'utf8');

let commands: [string, string | undefined][] = [];
beforeEach(() => {
  commands = [];
  // The browser's own editing, as far as tables need it: what is selected replaced by the HTML given, or taken away.
  (document as unknown as { execCommand: unknown }).execCommand = (command: string, _ui: boolean, value?: string) => {
    commands.push([command, value]);
    const selection = document.getSelection();
    if (!selection?.rangeCount || (command !== 'insertHTML' && command !== 'delete')) return true;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    if (command === 'insertHTML' && value) range.insertNode(range.createContextualFragment(value));
    return true;
  };
});

const rich = (tools: string[] = ['bold', 'table']) => {
  const mounted = mountKind({ type: 'html', label: 'Terms' }, { options: { tools } });
  const area = mounted.el.querySelector('.fd-text-area') as HTMLElement;
  return { ...mounted, area, tool: () => mounted.el.querySelector('[data-tool="table"]') as HTMLButtonElement };
};
const caretIn = (node: Node, at = 0) => {
  const range = document.createRange();
  range.setStart(node, at);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
};
const cellNamed = (area: HTMLElement, words: string) => [...area.querySelectorAll('td, th')].find((cell) => cell.textContent === words) as HTMLElement;
const menuItems = (el: Element) => [...el.querySelectorAll('.fd-text-menu:not([hidden]) .fd-text-menu-item')] as HTMLElement[];

describe('the rich editor’s table tool', () => {
  it('is a tool a page names, after the others; a page that names none has none', () => {
    const { tool } = rich();
    expect(tool().getAttribute('aria-label')).toBe('Table');
    expect(tool().getAttribute('aria-haspopup')).toBe('menu');
    expect(rich(['bold']).tool()).toBeNull();
  });

  it('picks a size on a grid of 8 by 8 — the cells up to the one moved to lit, its size in words — and puts the table in', () => {
    const { area, tool, el, value } = rich();
    area.innerHTML = '<p>Fees:</p>';
    area.focus();
    caretIn(area, 1);
    tool().click();
    const cells = menuItems(el);
    expect(cells).toHaveLength(64);
    expect(cells[0].getAttribute('aria-label')).toBe('1 row by 1 column');
    expect(cells[63].getAttribute('aria-label')).toBe('8 rows by 8 columns');
    expect(el.querySelector('.fd-table-pick')?.getAttribute('aria-label')).toBe('Insert a table');
    // Down a row and along two: 2 rows by 3 columns, the six cells up to it lit.
    press(cells[0], 'ArrowDown');
    press(document.activeElement as Element, 'ArrowRight');
    press(document.activeElement as Element, 'ArrowRight');
    expect(document.activeElement).toBe(cells[10]);
    expect(el.querySelector('.fd-table-pick-size')?.textContent).toBe('2 rows by 3 columns');
    expect(cells.flatMap((cell, i) => (cell.classList.contains('fd-on') ? [i] : []))).toEqual([0, 1, 2, 8, 9, 10]);
    // Along a row it stops at the row's end; up past the first row, nowhere.
    press(cells[7], 'ArrowRight');
    press(cells[2], 'ArrowUp');
    cells[10].click();
    expect(commands.filter(([c]) => c === 'insertHTML')).toEqual([['insertHTML', newTable(document, 2, 3).outerHTML]]);
    expect(area.querySelector('table')?.rows).toHaveLength(2);
    // The caret in its first cell, a line to write on after it, and the field's value the table.
    expect(document.getSelection()?.anchorNode).toBe(area.querySelector('th'));
    expect(area.querySelector('table')?.nextElementSibling?.outerHTML).toBe('<p><br></p>');
    expect(value()).toContain('<table><thead><tr><th><br></th>');
  });

  it('with the caret in a table, offers what may be done to it: no Delete row with one row', () => {
    const { area, tool, el } = rich();
    area.innerHTML = PRICES;
    area.focus();
    caretIn(cellNamed(area, 'Design').firstChild!, 1);
    tool().click();
    expect(menuItems(el).map((item) => item.textContent)).toEqual([
      'Insert row above', 'Insert row below', 'Insert column left', 'Insert column right', 'Delete row', 'Delete column', 'Header row', 'Delete table',
    ]);
    expect(menuItems(el)[6].getAttribute('role')).toBe('menuitemcheckbox');
    expect(menuItems(el)[6].getAttribute('aria-checked')).toBe('true');
    menuItems(el)[1].click();
    expect(shape(area.querySelector('table')!)).toEqual(['#Service #Qty #Amount', 'Design 2 3,000.00', '_ _ _', 'Total:2 3,000.00']);
    expect(el.querySelector('.fd-text-say')?.textContent).toBe('Row added.');
    // The caret in the new row's cell, under the one it was in.
    expect(document.getSelection()?.anchorNode).toBe(area.querySelector('table')!.rows[2].cells[0]);

    area.innerHTML = '<table><tbody><tr><td>one</td></tr></tbody></table>';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    caretIn(cellNamed(area, 'one').firstChild!, 1);
    tool().click();
    expect(menuItems(el).map((item) => item.textContent)).toEqual(['Insert row above', 'Insert row below', 'Insert column left', 'Insert column right', 'Header row', 'Delete table']);
    menuItems(el)[5].click();
    expect(area.querySelector('table')).toBeNull();
    expect(el.querySelector('.fd-text-say')?.textContent).toBe('Table deleted.');
  });

  it('right to left, Insert column left goes after the cell, as the table is drawn', () => {
    const { area, tool, el } = rich();
    area.innerHTML = '<table style="direction: rtl"><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';
    area.focus();
    caretIn(cellNamed(area, 'a').firstChild!, 1);
    tool().click();
    menuItems(el).find((item) => item.textContent === 'Insert column left')!.click();
    expect(shape(area.querySelector('table')!)).toEqual(['a _ b']);
  });

  it('Tab goes to the next cell, its words selected, Shift+Tab back; past the last a new row; said once', () => {
    const { area, el } = rich();
    area.innerHTML = '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>';
    area.focus();
    caretIn(cellNamed(area, 'a').firstChild!, 0);
    expect(el.querySelector('.fd-text-say')?.textContent).toBe('In a table, Tab goes to the next cell and Escape leaves the table.');
    press(area, 'Tab');
    expect(document.getSelection()?.toString()).toBe('b');
    press(area, 'Tab', { shiftKey: true });
    expect(document.getSelection()?.toString()).toBe('a');
    caretIn(cellNamed(area, 'd').firstChild!, 1);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    area.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(shape(area.querySelector('table')!)).toEqual(['a b', 'c d', '_ _']);
    expect(document.getSelection()?.anchorNode).toBe(area.querySelector('table')!.rows[2].cells[0]);
    // Outside a table, Tab is the page's: it leaves the box.
    area.innerHTML = '<p>words</p>';
    caretIn(area.querySelector('p')!.firstChild!, 1);
    const out = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    area.dispatchEvent(out);
    expect(out.defaultPrevented).toBe(false);
  });

  it('Escape leaves the table to the line after it, made where there is none, and closes nothing else', () => {
    const { area } = rich();
    area.innerHTML = '<table><tbody><tr><td>a</td></tr></tbody></table>';
    area.focus();
    caretIn(cellNamed(area, 'a').firstChild!, 1);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    area.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(area.innerHTML).toBe('<table><tbody><tr><td>a</td></tr></tbody></table><p><br></p>');
    expect(document.getSelection()?.anchorNode).toBe(area.querySelector('p'));
  });

  it('keeps a table pasted from Word, plain', () => {
    const { area, value } = rich(['bold']);
    area.focus();
    caretIn(area, 0);
    const paste = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), { clipboardData: { getData: (type: string) => (type === 'text/html' ? fixture('word-table') : '') } });
    area.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    area.dispatchEvent(new Event('input', { bubbles: true }));
    expect(value()).toBe(cleanPasted(fixture('word-table'), document));
    expect(area.querySelector('table td[colspan="3"]')?.textContent).toBe('Total');
  });

  it('a table’s empty cells are no empty text: no placeholder over them', () => {
    const { area } = rich();
    area.innerHTML = newTable(document, 2, 2).outerHTML;
    area.dispatchEvent(new Event('input', { bubbles: true }));
    expect(area.classList.contains('fd-blank')).toBe(false);
  });
});

describe('copied from a Fieldia editor and pasted back', () => {
  const LOOK = 'color: rgb(209, 52, 56); background-color: rgb(255, 255, 0); font-size: 20px;';
  const clipboard = () => {
    const data: Record<string, string> = {};
    return { data, setData: (type: string, words: string) => (data[type] = words), getData: (type: string) => data[type] ?? '', types: [] as string[], files: [] };
  };
  const copy = (area: HTMLElement, type: 'copy' | 'cut' = 'copy') => {
    const clipboardData = clipboard();
    const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clipboardData });
    area.dispatchEvent(event);
    return { data: clipboardData.data, prevented: event.defaultPrevented };
  };

  it('puts its selection on the clipboard as its own: a word copied out of its coloured span keeps it, its words beside', () => {
    const { area } = rich(['bold', 'colour', 'highlight', 'size']);
    area.innerHTML = `<p>Pay <span style="${LOOK}">late fees</span> in full.</p>`;
    area.focus();
    const words = area.querySelector('span')!.firstChild!;
    const range = document.createRange();
    range.setStart(words, 5);
    range.setEnd(words, 9);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    const { data, prevented } = copy(area);
    expect(prevented).toBe(true);
    expect(data).toEqual({ 'text/html': `<div data-fieldia-copy=""><span style="${LOOK}">fees</span></div>`, 'text/plain': 'fees' });
    // Cut: the same on the clipboard, the words taken away as one step Undo takes back.
    expect(copy(area, 'cut').data['text/plain']).toBe('fees');
    expect(commands.at(-1)).toEqual(['delete', undefined]);
  });

  it('pasted back, here or in another editor, keeps its own colour, highlight and size — and nothing it was not given', () => {
    const marked = `<div data-fieldia-copy=""><p>Pay <span class="x" onclick="x()" style="${LOOK} font-family: Georgia; position: fixed">late fees</span> <span data-mention="7">@Karim</span></p></div>`;
    expect(cleanPasted(marked, document)).toBe(`<p>Pay <span style="${LOOK}">late fees</span> <span data-mention="7">@Karim</span></p>`);
    // Without the mark, from anywhere else, its colours and sizes are left behind.
    expect(cleanPasted(marked.replace(' data-fieldia-copy=""', ''), document)).toBe('<div><p>Pay late fees <span data-mention="7">@Karim</span></p></div>');
    const { area, value } = rich(['bold']);
    area.focus();
    caretIn(area, 0);
    const paste = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), { clipboardData: { getData: (type: string) => (type === 'text/html' ? marked : '') } });
    area.dispatchEvent(paste);
    expect(value()).toBe(`<p>Pay <span style="${LOOK}">late fees</span> <span data-mention="7">@Karim</span></p>`);
  });
});

describe('the Markdown editor’s table tool', () => {
  it('puts a table to start from where the caret is, a blank line before it', () => {
    const mounted = mountKind({ type: 'html', label: 'Notes' }, { options: { editor: 'markdown', tools: ['bold', 'table'] } });
    const box = mounted.el.querySelector('.fd-md-input') as HTMLTextAreaElement;
    (mounted.el.querySelector('.fd-md-view') as HTMLElement).click();
    box.value = 'Fees:';
    box.setSelectionRange(5, 5);
    (mounted.el.querySelector('[data-tool="table"]') as HTMLButtonElement).click();
    const cells = menuItems(mounted.el);
    cells[PICK(2, 2)].click();
    expect(box.value).toBe('Fees:\n\n| Column 1 | Column 2 |\n| --- | --- |\n|   |   |\n\n');
    expect(mounted.value()).toBe('<p>Fees:</p><table><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead><tbody><tr><td></td><td></td></tr></tbody></table>');
  });
});

/** The picker's cell for a size: rows down, columns along. */
function PICK(rows: number, columns: number) {
  return (rows - 1) * 8 + columns - 1;
}
