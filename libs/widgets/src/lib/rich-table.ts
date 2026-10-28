import { fillIn } from './kind-parts';
import { givenHtml, heldHtml } from './style-attributes';
import { inPlural, type WidgetLabels } from './labels';
import type { MenuChoice } from './text-menu';

/**
 * Tables in the rich editor (the text part): one put in at a size picked on a
 * grid, rows and columns added and taken away where the caret is, a header
 * row on and off, Tab to the next cell — a row added past the last, as a
 * table of lines adds a line — and Escape out of the table. Each change is
 * the whole table put back changed (`insertHTML` over it), so it is one step
 * the browser's own Undo takes back, in every engine. Columns go left and
 * right as the table is drawn: mirrored right to left. A cell spanning
 * several (pasted from Word or Excel) is widened, narrowed or carried down as
 * its row or column changes, never split.
 */

type Cell = HTMLTableCellElement;

/** What may be done to a table where the caret is; `columnBefore`/`After` as the table's columns are written. */
export type TableEdit = 'rowAbove' | 'rowBelow' | 'columnBefore' | 'columnAfter' | 'deleteRow' | 'deleteColumn' | 'header';

const rowsOf = (table: HTMLTableElement): HTMLTableRowElement[] => [...table.rows];
const cellsOf = (row: HTMLTableRowElement): Cell[] => [...row.cells];

/** A table's cells by row and column: a cell spanning several stands in each place it covers; a short row has holes. */
export function tableGrid(table: HTMLTableElement): Cell[][] {
  const rows = rowsOf(table);
  const grid: Cell[][] = rows.map(() => []);
  rows.forEach((row, r) => {
    let c = 0;
    for (const cell of cellsOf(row)) {
      while (grid[r][c]) c++;
      const across = Math.max(1, cell.colSpan || 1);
      const down = Math.min(Math.max(1, cell.rowSpan || rows.length - r), rows.length - r);
      for (let y = r; y < r + down; y++) for (let x = c; x < c + across; x++) grid[y][x] = cell;
      c += across;
    }
  });
  return grid;
}

/** Where a cell starts: its first row and column. */
export function placeOf(grid: Cell[][], cell: Cell): [number, number] {
  for (let r = 0; r < grid.length; r++) {
    const c = grid[r].indexOf(cell);
    if (c >= 0) return [r, c];
  }
  return [0, 0];
}

const widthOf = (grid: Cell[][]) => Math.max(0, ...grid.map((line) => line.length));
/** How many columns a table has, and how many rows. */
export const tableWidth = (table: HTMLTableElement) => widthOf(tableGrid(table));
export const tableHeight = (table: HTMLTableElement) => table.rows.length;

/** A span written only where it spans: 1 is no attribute. */
function span(cell: Cell, name: 'colspan' | 'rowspan', n: number) {
  if (n > 1) cell.setAttribute(name, String(n));
  else cell.removeAttribute(name);
}

/** An empty cell the caret can stand in. */
function emptyCell(doc: Document, header: boolean): Cell {
  const cell = doc.createElement(header ? 'th' : 'td');
  cell.append(doc.createElement('br'));
  return cell;
}

/** A cell as a header's (`th`) or a plain one's (`td`), keeping what it holds and its attributes. */
function retag(cell: Cell, header: boolean): Cell {
  if ((cell.tagName === 'TH') === header) return cell;
  const next = cell.ownerDocument.createElement(header ? 'th' : 'td');
  for (const attribute of [...cell.attributes]) if (attribute.name !== 'scope' && attribute.name !== 'style') next.setAttribute(attribute.name, attribute.value);
  // Its looks (an alignment) through its style object, which a strict policy lets be: a style attribute it refuses.
  next.style.cssText = cell.style.cssText;
  next.append(...cell.childNodes);
  cell.replaceWith(next);
  return next;
}

/** A row of headers: in the table's head, or its cells all headers. */
const headerRow = (row: HTMLTableRowElement | undefined) => !!row && (row.parentElement?.tagName === 'THEAD' || (row.cells.length > 0 && cellsOf(row).every((cell) => cell.tagName === 'TH')));

/** Whether the table's first row is a header row. */
export const hasHeader = (table: HTMLTableElement) => headerRow(table.rows[0]);

/**
 * Formatted text's tables with their header row in their head: a first row of header cells among the rows — as Word,
 * Excel and Google Docs copy a table, and as an app may store one — moved into a head of its own, so a printout repeats
 * it at the top of every sheet and a screen reader reads it as the columns' names. A row whose cells run down into the
 * next stays where it is. The words as they were where no table has such a row.
 */
export function headedTables(html: string, doc: Document): string {
  if (!/<th[\s>]/i.test(html)) return html;
  const box = doc.createElement('template');
  // Read with its cells' styles held, as a strict policy refuses a style attribute read as HTML (style-attributes.ts).
  box.innerHTML = heldHtml(html);
  let moved = false;
  for (const table of box.content.querySelectorAll('table')) {
    const first = table.rows[0];
    if (table.tHead || !first || first.parentElement?.tagName === 'TFOOT' || !headerRow(first) || cellsOf(first).some((cell) => (cell.rowSpan || 1) > 1)) continue;
    const section = first.parentElement === table ? first : (first.parentElement as HTMLElement);
    table.insertBefore(doc.createElement('thead'), section).append(first);
    for (const body of [...table.tBodies]) if (!body.rows.length) body.remove();
    moved = true;
  }
  return moved ? givenHtml(box.innerHTML) : html;
}

/** A new table of empty cells, its first row a header row. */
export function newTable(doc: Document, rows: number, columns: number): HTMLTableElement {
  const table = doc.createElement('table');
  const line = (header: boolean) => {
    const row = doc.createElement('tr');
    for (let c = 0; c < columns; c++) row.append(emptyCell(doc, header));
    return row;
  };
  const head = doc.createElement('thead');
  head.append(line(true));
  const body = doc.createElement('tbody');
  for (let r = 1; r < rows; r++) body.append(line(false));
  table.append(head, ...(rows > 1 ? [body] : []));
  return table;
}

/**
 * The table changed as `edit` says, from the cell the caret is in: a copy (the table itself is left as it is), and
 * the row and column the caret goes to in it — or null, the table gone (its last row or column taken away).
 */
export function editTable(table: HTMLTableElement, cell: Cell, edit: TableEdit): { table: HTMLTableElement; at: [number, number] } | null {
  const [r0, c0] = placeOf(tableGrid(table), cell);
  const copy = table.cloneNode(true) as HTMLTableElement;
  const doc = table.ownerDocument;
  const grid = tableGrid(copy);
  const rows = rowsOf(copy);
  const width = widthOf(grid);
  const here = grid[r0][c0];
  const bumped = new Set<Cell>();

  if (edit === 'rowAbove' || edit === 'rowBelow') {
    const at = edit === 'rowAbove' ? r0 : r0 + Math.max(1, here.rowSpan || 1);
    const before = rows[at - 1];
    // Above a header row, another; below one, the body's first row — a header only between two.
    const header = edit === 'rowAbove' ? headerRow(rows[r0]) : headerRow(before) && headerRow(rows[at]);
    const row = doc.createElement('tr');
    for (let c = 0; c < width; c++) {
      const over = grid[at - 1]?.[c];
      if (over && over === grid[at]?.[c]) {
        if (!bumped.has(over)) span(over, 'rowspan', (over.rowSpan || 1) + 1);
        bumped.add(over);
        continue;
      }
      row.append(emptyCell(doc, header));
    }
    if (edit === 'rowAbove') rows[r0].before(row);
    else if (before.parentElement?.tagName === 'THEAD' && !header) (copy.tBodies[0] ?? copy.insertBefore(doc.createElement('tbody'), copy.tFoot)).prepend(row);
    else before.after(row);
    return { table: copy, at: [at, c0] };
  }

  if (edit === 'columnBefore' || edit === 'columnAfter') {
    const at = edit === 'columnBefore' ? c0 : c0 + Math.max(1, here.colSpan || 1);
    rows.forEach((row, r) => {
      const left = grid[r][at - 1];
      if (left && left === grid[r][at]) {
        if (!bumped.has(left)) span(left, 'colspan', (left.colSpan || 1) + 1);
        bumped.add(left);
        return;
      }
      const next = cellsOf(row).find((one) => placeOf(grid, one)[1] >= at);
      row.insertBefore(emptyCell(doc, headerRow(row)), next ?? null);
    });
    return { table: copy, at: [r0, at] };
  }

  if (edit === 'deleteRow') {
    const row = rows[r0];
    if (rows.length === 1) return null;
    const next = rows[r0 + 1];
    for (let c = 0; c < width; c++) {
      const one = grid[r0][c];
      if (!one || bumped.has(one)) continue;
      bumped.add(one);
      const [start] = placeOf(grid, one);
      if (start < r0) span(one, 'rowspan', one.rowSpan - 1);
      else if ((one.rowSpan || 1) > 1 && next) {
        // A cell that runs on down goes on from the next row.
        span(one, 'rowspan', one.rowSpan - 1);
        next.insertBefore(one, cellsOf(next).find((other) => placeOf(grid, other)[1] > c) ?? null);
      }
    }
    const section = row.parentElement as HTMLElement;
    row.remove();
    if (section !== copy && !section.querySelector('tr')) section.remove();
    return { table: copy, at: [Math.min(r0, rows.length - 2), c0] };
  }

  if (edit === 'deleteColumn') {
    if (width <= 1) return null;
    for (let r = 0; r < grid.length; r++) {
      const one = grid[r][c0];
      if (!one || bumped.has(one)) continue;
      bumped.add(one);
      if ((one.colSpan || 1) > 1) span(one, 'colspan', one.colSpan - 1);
      else one.remove();
    }
    return { table: copy, at: [r0, Math.min(c0, width - 2)] };
  }

  // The header row on or off: the first row's cells headers, in the table's head, or plain cells in its body.
  const first = rows[0];
  if (hasHeader(copy)) {
    const head = copy.tHead;
    const body = copy.tBodies[0] ?? copy.insertBefore(doc.createElement('tbody'), copy.tFoot);
    for (const row of head ? rowsOf(copy).filter((one) => one.parentElement === head) : [first]) cellsOf(row).forEach((one) => retag(one, false));
    if (head) {
      body.prepend(...head.rows);
      head.remove();
    }
  } else {
    cellsOf(first).forEach((one) => retag(one, true));
    // A row whose cells run down into the next stays where it is: a head ends where its rows do.
    if (!cellsOf(first).some((one) => (one.rowSpan || 1) > 1)) {
      const head = copy.insertBefore(doc.createElement('thead'), first.parentElement === copy ? first : (first.parentElement as HTMLElement));
      head.append(first);
      for (const section of [...copy.tBodies]) if (!section.rows.length) section.remove();
    }
  }
  return { table: copy, at: [r0, c0] };
}

/** The cell `at` (row, column) of a table, or the nearest one there is. */
export function cellAt(table: HTMLTableElement, [r, c]: [number, number]): Cell | null {
  const grid = tableGrid(table);
  const line = grid[Math.min(r, grid.length - 1)] ?? [];
  return line[Math.min(c, line.length - 1)] ?? null;
}

/** Every cell of a table once, in the order Tab reaches them: row by row, each row's in its order. */
export const cellsInOrder = (table: HTMLTableElement): Cell[] => rowsOf(table).flatMap(cellsOf);

// ---- the tool's picker -------------------------------------------------------------------------------------------

/** A table's size as a person reads it: "3 rows by 4 columns". */
export function tableSize(labels: WidgetLabels, rows: number, columns: number, locale?: string): string {
  return fillIn(labels.tableSize, { rows: inPlural(labels.tableRows, labels.tableRowsOne, rows, locale), columns: inPlural(labels.tableColumns, labels.tableColumnsOne, columns, locale) });
}

/** The tool's picker: a grid of cells, the size each stands for, the cells up to the one pointed at lit. */
export const PICK_ROWS = 8;
export const PICK_COLUMNS = 8;

/** The picker's choices, row by row: each puts in a table of its size. */
export function pickerChoices(doc: Document, labels: WidgetLabels, locale: string | undefined, pick: (rows: number, columns: number) => void): MenuChoice[] {
  const choices: MenuChoice[] = [];
  for (let r = 1; r <= PICK_ROWS; r++) {
    for (let c = 1; c <= PICK_COLUMNS; c++) {
      const lead = doc.createElement('span');
      lead.className = 'fd-table-pick-cell';
      lead.setAttribute('aria-hidden', 'true');
      choices.push({ label: tableSize(labels, r, c, locale), lead, run: () => pick(r, c) });
    }
  }
  return choices;
}

/** A Markdown table, its first row the header's ("Column 1"…), the rest empty, for the Markdown editor's table tool. */
export function markdownTable(rows: number, columns: number, heading: (n: number) => string): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const each = (cell: (c: number) => string) => Array.from({ length: columns }, (_, c) => cell(c));
  return [line(each((c) => heading(c + 1))), line(each(() => '---')), ...Array.from({ length: rows - 1 }, () => line(each(() => ' ')))].join('\n');
}
