import { isEmpty, labelAt, lineKind, recomputeInFull, wordsVersion, type Field, type FieldNode, type Form, type FormState, type Line, type LineField, type Locale, type Value, type Values } from '@fieldia/core';
import { blockOf, pasteRows, type PasteTable } from './cell-paste';
import { dateOrderOf, dateShape } from './date-text';
import { cellText, currencyOf, keepsWhole } from './display';
import { drawIcon } from './icons';
import { askFirst, fillIn, maker, setHidden } from './kind-parts';
import { WIDGET_LABELS } from './labels';
import { lineCopy, moveLineTo } from './line-moves';
import { columnTotal, itemNumber, kindTextField, lineColumn, lineForm, openLineDialog, waitingTotal } from './lines';
import { afterPress } from './press';
import { installLinesStyles } from './styles-lines';
import type { createWidget, Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A one2many as an editable table. Each cell is an ordinary widget; a small
 * adapter routes its edits to `updateLine` and its searches to `searchLine`,
 * so a many2one inside a line searches with that line's own values. Rows are
 * matched by line key, so adding or removing a line never rebuilds the others.
 * When the field declares `lineKinds`, a section or a note is one wide row of
 * its text.
 *
 * A line moves by the grip at its start, or by Alt+↑/↓ from inside it, said
 * aloud; drawn as a card, where the grip is not, by its ↑ and ↓ — a phone
 * has no Alt key. A block copied from a spreadsheet and pasted in a cell fills across
 * and down from it, each cell read as its column reads what is typed, lines
 * added for the rows past the last, as the grid pastes (cell-paste.ts). The node's `options`: `min` lines at least — a new table starts with
 * them — and `max` at most; `addLabel`, the Add button's words (and
 * `addSectionLabel`, `addNoteLabel`, its section's and note's); `emptyLabel`,
 * a sentence while there is no line; `confirmDelete`, asking before a line
 * with something in it goes.
 *
 * It comes in the lines part (parts.ts), loaded the first time a page shows a
 * table of lines, with its stylesheet (styles-lines.ts); its lines as plain
 * words meanwhile (lines-plain.ts). What it edits a line through — the form a
 * cell sees, a column's total, a line's dialog — is the main script's
 * (lines.ts), shared with the grid and the cards.
 */

/** The kinds of field a line is named by: words, and a link by its name. */
const NAMING = new Set(['char', 'text', 'html', 'many2one', 'reference']);

/**
 * The words a line is named by — its ↑ and ↓, its move said aloud, its dialog's title, a table's or a card's: the first of
 * its `columns` of words (a name, a description, a link: never a number or a day) that holds some, as its cell reads at
 * rest (a link by its name); none where it has none.
 */
export function namingWords(form: Form, name: string, node: FieldNode, line: Line, columns: readonly string[], locale?: Locale): string {
  const def = form.page.fields[name] as Extract<Field, { type: 'one2many' }>;
  for (const column of columns) {
    if (!NAMING.has(def.fields[column]?.type)) continue;
    const words = cellText(lineColumn(form, name, line.key, column, def.fields[column]), line.values[column], line.values, locale, form.getState().values, node.cells?.[column]).trim();
    if (words) return words;
  }
  return '';
}
/** The kinds of field whose column is as wide as its values, so the columns of words and links have the rest. */
/** Columns of numbers, which grow past their kind's width for a long value. */
const NUMERIC = new Set(['integer', 'float', 'monetary']);
const FIXED_WIDTH = new Set(['boolean', 'integer', 'float', 'monetary', 'date', 'datetime']);

/** A line being dragged by its grip. */
interface Drag {
  follow(y: number): void;
  drop(): void;
  settle(): void;
}

interface Row {
  element: HTMLTableRowElement;
  kind: 'section' | 'note' | null;
  cells: { name: string; def: LineField; widget: Widget; error: HTMLElement; td: HTMLTableCellElement; waiting?: HTMLElement }[];
  /** The line's own buttons, by their id. */
  buttons: Map<string, HTMLButtonElement>;
  remove: HTMLButtonElement;
  grip: HTMLElement;
  /** Its ↑ and ↓, on its card (a phone has no grip to drag and no Alt key); none where the table is never cards. */
  moves: { up: HTMLButtonElement; down: HTMLButtonElement; said?: string } | null;
  /** The tick that chooses the line for the table's buttons for chosen lines; none without them, or on a section or note. */
  pick: HTMLInputElement | null;
  /** The button that puts a copy of the line right after it (`options.copy`). */
  copy: HTMLButtonElement | null;
  /** The line's values it was last drawn with, and what else it was drawn from: drawn again only when one changes. */
  values?: Readonly<Values>;
  inputs?: readonly unknown[];
  /** Its number as people count lines, as its tick and copy say it. */
  number?: number;
}

/** Two values the same, a link's or a list's by what they hold. */
const sameValue = (a: unknown, b: unknown) => a === b || (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b));
/** A line's values the same as those it was drawn with: the same object, or the same fields holding the same values. */
function sameValues(a: Readonly<Values>, b: Readonly<Values>): boolean {
  if (a === b) return true;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => key in b && sameValue(a[key], b[key]));
}
const sameInputs = (a: readonly unknown[] | undefined, b: readonly unknown[]) => !!a && a.length === b.length && a.every((one, i) => one === b[i]);

const count = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined);

/**
 * A table of lines, its cells drawn with the registry's `createWidget` — handed to it rather than imported: a part that
 * imported the registry would make an app's bundler split the registry off with the part, and run it before the widgets
 * it holds.
 */
export const linesWidget =
  (create: typeof createWidget): WidgetFactory =>
  (context) =>
    linesTable(context, create);

function linesTable({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, locale, dialogs, widgets, onError }: WidgetContext, create: typeof createWidget): Widget {
  installLinesStyles(document);
  const def = field as Extract<Field, { type: 'one2many' }>;
  const kinds = def.lineKinds;
  const make = maker(document);
  const options = node.options ?? {};
  /** A line of the table's own, not a section or a note: what is numbered, totalled and worked out. */
  const isItem = (line: Line) => !lineKind(def, line.values);
  /**
   * A number worked out on a line (read-only, or computed) while a cell of that line holds text that does not read:
   * the words it waits with, naming that cell; null when it shows its value.
   */
  const waitsOn = (line: Line, column: string, unread: Readonly<Record<string, { text: string }>> | undefined): string | null => {
    const sub = def.fields[column];
    if (!sub || !isItem(line) || !['integer', 'float', 'monetary'].includes(sub.type) || (sub.readonly !== true && sub.compute === undefined)) return null;
    const other = Object.keys(def.fields).find((name2) => name2 !== column && unread?.[`${name}.${line.key}.${name2}`]);
    const small = (key: string) => labelAt(labels.cellWaits, key, form.page.lowerLabels, locale);
    return other ? fillIn(labels.cellWaits, { column: small('column')(def.fields[other].label), own: small('own')(sub.label) }) : null;
  };
  const min = count(options['min']) ?? 0;
  const max = count(options['max']) ?? Infinity;
  const words = (key: string) => (typeof options[key] === 'string' && (options[key] as string).trim() ? (options[key] as string) : null);
  // The fields that say what a line is and keep the lines' order never show as columns.
  // Optional columns the page starts hidden stay out of the plain table.
  const heads = new Map<string, HTMLTableCellElement>();
  // The table's own rules, read by the form line by line; a table with none asks nothing.
  const ruled = !!(node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons || node.lineDelete !== undefined);
  const columns = (node.columns ?? Object.keys(def.fields)).filter(
    // Lines a line holds are edited in its form, never drawn in its row.
    (column) => def.fields[column] && def.fields[column].type !== 'one2many' && column !== kinds?.field && column !== def.sequenceField && node.optionalColumns?.[column] !== 'hide'
  );
  // The columns a line is named by: its columns of words (a name, a description, a link), never a number or a day.
  const naming = columns.filter((column) => NAMING.has(def.fields[column].type));
  /**
   * A line as a person names it — its ↑ and ↓, its move said aloud, its dialog's title: a section's or a note's words,
   * else the first of its columns of words that holds some, as its cell reads at rest (a link by its name); none where
   * it has none.
   */
  /** A name begun with its capital, as a title begins: "Line 3". */
  const capital = (words: string) => words.charAt(0).toLocaleUpperCase(locale) + words.slice(1);
  const wordsOf = (line: Line) => (!isItem(line) && kinds ? String(line.values[kinds.text] ?? '').trim() : namingWords(form, name, node, line, naming, locale));
  const element = document.createElement('div');
  element.className = 'fd-lines';
  element.id = id;
  // Lines as cards on a narrow form — as where the page says nothing: a table's boxes cut their words at a phone's width
  // however its columns share it — or always; rows at every width only where it says `never`. Columns as wide as they
  // hold. The stylesheet draws them so.
  const cards = node.cards ?? 'narrow';
  if (cards !== 'never') element.dataset['cards'] = cards;
  if (node.fit) element.dataset['fit'] = node.fit;
  element.setAttribute('role', 'group');
  const scroller = document.createElement('div');
  scroller.className = 'fd-lines-scroll';
  const table = document.createElement('table');
  table.className = 'fd-lines-table';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  // Lines chosen for the table's buttons for them: a tick on each line, one in the head for every line, and a bar over the table.
  const choosing = !!node.selectedButtons?.length;
  const chosen = new Set<string>();
  const pickAll = choosing ? (make('input', { type: 'checkbox', class: 'fd-checkbox fd-line-pick fd-line-pick-all', 'aria-label': labels.chooseAllLines }) as HTMLInputElement) : null;
  headRow.append(make('th', { class: 'fd-lines-grip' }, ...(pickAll ? [pickAll] : [])));
  for (const column of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.dataset['column'] = column;
    th.textContent = def.fields[column].label;
    const width = node.cells?.[column]?.width;
    if (width) th.style.width = `${width}ch`;
    // Its kind, which sizes a column of yes/no, numbers, money or dates to its values, as Flectra's lists do.
    else if (FIXED_WIDTH.has(def.fields[column].type)) th.dataset['fit'] = def.fields[column].type;
    heads.set(column, th);
    headRow.append(th);
  }
  const lastTh = document.createElement('th');
  lastTh.className = 'fd-lines-tools';
  headRow.append(lastTh);
  head.append(headRow);
  const body = document.createElement('tbody');
  table.append(head, body);
  // Number columns the page asks to add up, in a row under the lines.
  const totals = (node.totals ?? []).filter((column) => columns.includes(column));
  const sums = new Map<string, HTMLTableCellElement>();
  const footCells = new Map<string, HTMLTableCellElement>();
  if (totals.length) {
    const foot = document.createElement('tfoot');
    const row = document.createElement('tr');
    row.className = 'fd-lines-totals';
    row.append(document.createElement('td'));
    columns.forEach((column, i) => {
      const td = document.createElement('td');
      td.dataset['column'] = column;
      // A number's total reads from the end, under its column's numbers.
      if (FIXED_WIDTH.has(def.fields[column].type)) td.dataset['fit'] = def.fields[column].type;
      footCells.set(column, td);
      if (totals.includes(column)) sums.set(column, td);
      else if (i === 0) td.textContent = labels.total;
      row.append(td);
    });
    row.append(document.createElement('td'));
    foot.append(row);
    table.append(foot);
  }
  scroller.append(table);
  const adds = document.createElement('div');
  adds.className = 'fd-lines-adds';
  const addButton = (text: string, values: Record<string, Value>, kind: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fd-button fd-button-link fd-lines-add';
    button.dataset['add'] = kind;
    button.textContent = `+ ${text}`;
    button.addEventListener('click', () => {
      focusNew = form.addLine(name, values);
      const row = rows.get(focusNew);
      if (row) {
        row.cells[0]?.widget.focus();
        focusNew = null;
      }
    });
    adds.append(button);
  };
  addButton(words('addLabel') ?? labels.addLine, {}, 'line');
  if (kinds) {
    addButton(words('addSectionLabel') ?? labels.addSection, { [kinds.field]: kinds.section ?? 'section' }, 'section');
    addButton(words('addNoteLabel') ?? labels.addNote, { [kinds.field]: kinds.note ?? 'note' }, 'note');
  }
  // Buttons in the control row, beside the add buttons: the record's, shown by a condition on it (Flectra's <control>).
  const controls = (node.controlButtons ?? []).map((own) => {
    const icon = drawIcon(document, own.icon);
    const button = make('button', { type: 'button', class: 'fd-button fd-button-link fd-lines-add fd-lines-control', 'data-node': own.id }, ...(icon ? [icon] : []), own.label);
    button.addEventListener('click', () => void pressed(button, () => form.runAction(own.id)));
    adds.append(button);
    return { id: own.id, button };
  });
  // The bar of buttons for the lines chosen, over the table while any is.
  const chosenCount = make('span', { class: 'fd-lines-chosen-count', role: 'status' });
  const chosenButtons = (node.selectedButtons ?? []).map((own) => {
    const icon = drawIcon(document, own.icon);
    const button = make('button', { type: 'button', class: `fd-button fd-button-${own.style ?? 'secondary'} fd-lines-chosen-button`, 'data-node': own.id }, ...(icon ? [icon] : []), own.label);
    // In the table's order, whatever order they were ticked in.
    button.addEventListener('click', () => void pressed(button, () => form.runLinesAction(node.id, own.id, current().filter((line) => chosen.has(line.key)).map((line) => line.key))));
    return { id: own.id, button };
  });
  const bar = choosing ? make('div', { class: 'fd-lines-chosen', hidden: '' }, chosenCount, ...chosenButtons.map((b) => b.button)) : null;
  const emptyWords = words('emptyLabel');
  const empty = emptyWords ? make('div', { class: 'fd-help fd-lines-empty' }, emptyWords) : null;
  // Removing a line with something in it asks first, in place: "Remove line 2?  Remove · Keep".
  const confirm = askFirst(make, { yes: labels.removeFile, no: labels.keep });
  // Where a line went, said politely; not the page's own announcer, which a page looks for by its class.
  const voice = make('div', { class: 'fd-sr-only', role: 'status' });
  // What a block pasted on the cells did, said politely: how many cells took it, the lines added, and which did not.
  const pasteNote = make('div', { class: 'fd-help fd-lines-paste-note', role: 'status', 'aria-live': 'polite', hidden: '' });
  element.append(...(bar ? [bar] : []), scroller, pasteNote, ...(empty ? [empty] : []), adds, confirm.element, voice);
  /** A press that waits for its run, and is not pressed again meanwhile. */
  async function pressed(button: HTMLButtonElement, run: () => Promise<unknown>) {
    if (button.hasAttribute('aria-busy')) return;
    button.setAttribute('aria-busy', 'true');
    try {
      await run();
    } finally {
      button.removeAttribute('aria-busy');
    }
  }
  /** The bar and the head's tick, as the lines chosen are now. */
  function showChosen() {
    if (!bar || !pickAll) return;
    const items = current().filter((line) => !lineKind(def, line.values));
    for (const key of [...chosen]) if (!items.some((line) => line.key === key)) chosen.delete(key);
    setHidden(bar, readonly || chosen.size === 0);
    chosenCount.textContent = fillIn(labels.linesChosen, { n: chosen.size });
    for (const { id, button } of chosenButtons) setHidden(button, form.node(id).invisible);
    pickAll.checked = items.length > 0 && chosen.size === items.length;
    pickAll.indeterminate = chosen.size > 0 && chosen.size < items.length;
    pickAll.disabled = readonly || !items.length;
    for (const [key, row] of rows) {
      if (!row.pick) continue;
      if (row.pick.checked !== chosen.has(key)) row.pick.checked = chosen.has(key);
      if (row.pick.disabled !== readonly) row.pick.disabled = readonly;
    }
  }
  pickAll?.addEventListener('change', () => {
    const items = current().filter((line) => !lineKind(def, line.values));
    if (pickAll.checked) for (const line of items) chosen.add(line.key);
    else chosen.clear();
    showChosen();
  });

  const rows = new Map<string, Row>();
  /** The record's fields a line's money takes its currency from (`parent.currency_id`): every line is drawn again as one changes. */
  const parentReads = [...new Set(Object.values(def.fields).flatMap((sub) => (sub.type === 'monetary' && sub.currencyField?.startsWith('parent.') ? [sub.currencyField.slice('parent.'.length)] : [])))];
  /**
   * A column drawn by a widget of the app's own (the viewer's `widgets`): it may show anything of the record its line is
   * on, so every line is drawn again as the record changes, as every line always was.
   */
  const appDrawn = !!widgets && Object.entries(def.fields).some(([column, sub]) => {
    const look = node.cells?.[column];
    const widget = look?.badge ? 'badge' : look?.widget;
    return [widget ? `${sub.type}.${widget}` : '', sub.type === 'selection' && (sub as { multiple?: boolean }).multiple ? 'selection.checkboxes' : '', sub.type].some((key) => !!key && key in (widgets as object));
  });
  /** The columns whose options follow the line or the record (their conditions, a field's options): read for each line as it is drawn. */
  const optionColumns = columns.filter((column) => {
    // As core's `changesOptions` has it: a condition on one of its options, or its options carried from another field.
    const sub = def.fields[column];
    return sub.type === 'selection' && ((!!sub.optionsFrom && 'field' in sub.optionsFrom) || sub.options.some((option) => option.invisible !== undefined && option.invisible !== false));
  });
  const offeredOf = (line: Line): string[] => (optionColumns.length && form.offered ? [JSON.stringify(optionColumns.map((column) => form.offered?.(`${name}.${line.key}.${column}`) ?? null))] : []);
  /** What the table was last drawn for as a whole: its state, the lines' count against its limits, its columns hidden, the record's currency. */
  let drawnFor = '';
  /** Made to work every change out in full (`recomputeInFull`, the plain way the quick one is held to): every line drawn again at each. */
  const full = recomputeInFull();
  let drawnRecord: unknown = null;
  /**
   * What the record holds for each line, by its key, read once for every line: its problems, its text that does not
   * read and the options taken out of its choices (`said`, in words), the choices the app gave it and its uploads (`held`).
   */
  function linesOwn(now: FormState): Map<string, { said: Record<string, Record<string, unknown>>; held: unknown[] }> {
    const prefix = `${name}.`;
    const out = new Map<string, { said: Record<string, Record<string, unknown>>; held: unknown[] }>();
    const of = (key: string) => {
      let one = out.get(key);
      if (!one) out.set(key, (one = { said: {}, held: [] }));
      return one;
    };
    const cellAt = (path: string): [string, string] | null => {
      if (!path.startsWith(prefix)) return null;
      const rest = path.slice(prefix.length);
      const dot = rest.lastIndexOf('.');
      return dot > 0 ? [rest.slice(0, dot), rest.slice(dot + 1)] : null;
    };
    for (const [kind, map] of [['errors', now.errors], ['unread', now.unread], ['takenOut', now.takenOut]] as const) {
      for (const [path, value] of Object.entries(map ?? {})) {
        const cell = cellAt(path);
        if (cell) (of(cell[0]).said[kind] ??= {})[cell[1]] = value;
      }
    }
    for (const [path, value] of Object.entries(now.choices ?? {})) {
      const cell = cellAt(path);
      if (cell) of(cell[0]).held.push(cell[1], value);
    }
    for (const upload of now.uploads ?? []) if (upload.line?.field === name) of(upload.line.key).held.push(upload);
    return out;
  }
  /** A line's tick and copy named by its number, as people count lines (sections and notes are not lines): it moves. */
  function named(row: Row, number: number) {
    row.number = number;
    const lineName = fillIn(labels.lineN, { n: number });
    row.pick?.setAttribute('aria-label', fillIn(labels.chooseLine, { name: lineName }));
    if (row.copy) {
      row.copy.setAttribute('aria-label', fillIn(labels.copy, { name: lineName }));
      row.copy.title = row.copy.getAttribute('aria-label') as string;
    }
  }
  /**
   * A line's ↑ and ↓ as it stands now: the one that would take it past an end hidden, never disabled, and each named by
   * the line's words — its first column's, a section's or a note's — else by its number. Every line, every time, as its
   * place changes with no change in it; each written only where it changed.
   */
  function placeMoves(moves: NonNullable<Row['moves']>, line: Line, index: number, count: number, number: number) {
    const up = readonly || index === 0;
    const down = readonly || index === count - 1;
    if (moves.up.hidden !== up) moves.up.hidden = up;
    if (moves.down.hidden !== down) moves.down.hidden = down;
    const said = wordsOf(line) || fillIn(labels.lineN, { n: number || index + 1 });
    if (moves.said === said) return;
    moves.said = said;
    for (const [button, pattern] of [[moves.up, labels.moveUp], [moves.down, labels.moveDown]] as const) {
      button.setAttribute('aria-label', fillIn(pattern, { label: said }));
      button.title = button.getAttribute('aria-label') as string;
    }
  }
  /** The cell being left now, by its path: a problem leaving it finds is said by its message. */
  let leaving: string | null = null;
  let focusNew: string | null = null;
  let readonly = false;
  /** The lines the columns were last sized for, by their keys. */
  let columnsSizedFor: string | null = null;
  const current = () => (form.getState().values[name] as Line[] | null) ?? [];
  // A new table starts with the lines it needs at least.
  for (let have = current().length; have < min; have++) form.addLine(name);

  /** A line to another place, the focus kept where it was, and where it went said aloud. */
  function move(key: string, to: number) {
    const from = current().findIndex((line) => line.key === key);
    if (readonly || to === from || to < 0 || to >= current().length) return;
    const focused = document.activeElement as HTMLElement | null;
    // Named by its words, else by where it was.
    const words = wordsOf(current()[from]);
    // Where it is on the screen, kept as it goes: a card moved stays where the eye is (kept-in-sight.ts).
    const top = rows.get(key)?.element.getBoundingClientRect().top;
    moveLineTo(form, name, def, key, to);
    keepInSight(rows.get(key)?.element, top);
    if (focused && focused !== document.activeElement) focused.focus({ preventScroll: true });
    voice.textContent = fillIn(labels.movedTo, { label: words || fillIn(labels.lineN, { n: itemNumber(current(), key, isItem) || from + 1 }), n: to + 1, total: current().length });
  }
  /**
   * A line lifted by its grip: it follows the pointer, the lines it passes
   * slide out of its way, and the table's value changes once, when it is let
   * go — as a grid's row drags. Escape puts it back.
   */
  function lift(tr: HTMLTableRowElement, key: string, startY: number): Drag {
    const all = [...body.children] as HTMLElement[];
    const from = all.indexOf(tr);
    const others = all.filter((row) => row !== tr);
    const box = tr.getBoundingClientRect();
    const middles = others.map((row) => {
      const at = row.getBoundingClientRect();
      return at.top + at.height / 2;
    });
    let to = from;
    let lifted = false;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      settle();
    };
    function settle() {
      for (const row of all) row.style.transform = '';
      tr.classList.remove('fd-line-lifted');
      body.classList.remove('fd-lines-dragging');
      document.removeEventListener('keydown', escape, true);
      lifted = false;
    }
    return {
      follow(y: number) {
        const by = y - startY;
        if (!lifted) {
          // A press that hardly moves is not a drag yet.
          if (Math.abs(by) < 4 || readonly) return;
          lifted = true;
          tr.classList.add('fd-line-lifted');
          body.classList.add('fd-lines-dragging');
          document.addEventListener('keydown', escape, true);
        }
        tr.style.transform = `translateY(${by}px)`;
        // Its place: after every other line whose middle its own middle has passed.
        const middle = box.top + box.height / 2 + by;
        to = middles.filter((at) => at < middle).length;
        others.forEach((row, i) => {
          row.style.transform = i >= from && i < to ? `translateY(${-box.height}px)` : i < from && i >= to ? `translateY(${box.height}px)` : '';
        });
      },
      drop() {
        const moved = lifted && to !== from;
        settle();
        if (moved) move(key, to);
      },
      settle,
    };
  }
  body.addEventListener('keydown', (event) => {
    const key = (event.target as Element).closest('tr')?.dataset['line'];
    if (!key || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    move(key, current().findIndex((line) => line.key === key) + (event.key === 'ArrowUp' ? -1 : 1));
  });
  // ---- a block pasted from a spreadsheet ----------------------------------------------------------------------

  /** Whether a line's cell takes what is pasted now, as its box takes typing: an item's, not read-only, worked out or hidden. */
  const typable = (line: Line, column: string) => {
    const sub = def.fields[column];
    const rules = ruled ? form.lineState(node.id, line.key).cells[column] : undefined;
    return !readonly && isItem(line) && sub.readonly !== true && sub.compute === undefined && !rules?.readonly && !rules?.invisible;
  };
  /**
   * A block pasted on a cell — tabs between its cells, a line break between its rows, as a spreadsheet copies one —
   * goes row by row on the lines from there, across the columns shown (`pasteRows`, the grid's way too): each cell read
   * as its column reads what is typed, a link's by its name through the source's search; a row whose name reads as no
   * record not pasted at all; rows past the last line add lines, as many as the table may have. What did not go in is
   * named with why, all of it said in one note under the table. One paste at a time: the next waits for the names of
   * the one before.
   */
  let pasting: Promise<unknown> = Promise.resolve();
  let destroyed = false;
  function pasteBlock(fromKey: string, fromColumn: string, block: string[][]) {
    const shown = columns.filter((column) => !(ruled && form.columnHidden(node.id, column)));
    const dateOrder = dateOrderOf(form);
    const stillShown = form.recordShown();
    const table: PasteTable = {
      fields: def.fields as Record<string, LineField>,
      columns: shown,
      lines: current,
      add: () => (current().length >= max ? null : form.addLine(name)),
      typable,
      reading: (line, column) => ({ locale: locale ?? 'en', widget: node.cells?.[column]?.widget, dateOrder, currency: currencyOf(def.fields[column], line.values, form.getState().values) }),
      // By its line's number as people count lines; a section's or a note's by its words.
      cellName: (line, column) => {
        const number = itemNumber(current(), line.key, isItem);
        const sub = def.fields[column];
        return number ? fillIn(labels.cellName, { column: sub.label, n: number }) : fillIn(labels.cellOfHeading, { column: sub.label, heading: kinds ? String(line.values[kinds.text] ?? '') : '' });
      },
      write: (line, column, value) => {
        form.setUnread(`${name}.${line.key}.${column}`, null);
        form.updateLine(name, line.key, column, value);
      },
      search: (key, column, query, limit, exact) => form.searchLine(name, key, column, query, limit, exact ? { exact: true } : {}),
      choices: (key, column, values) => form.lineChoices(name, key, column, values),
      shown: () => stillShown() && !destroyed,
    };
    const from = current().findIndex((line) => line.key === fromKey);
    if (from < 0) return;
    pasting = pasting.then(() =>
      pasteRows(table, from, shown.includes(fromColumn) ? fromColumn : shown[0], block, { labels, locale }).then((said) => {
        if (said === null || destroyed) return;
        pasteNote.textContent = said;
        pasteNote.hidden = !said;
      }, () => undefined)
    );
  }
  // Heard before the box's own paste: one value is the box's, as is a paragraph's text of several lines with no tabs.
  body.addEventListener(
    'paste',
    (event) => {
      const box = event.target as HTMLElement;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (readonly || !text || !(box instanceof HTMLInputElement || box instanceof HTMLTextAreaElement)) return;
      const block = blockOf(text);
      if ((block.length < 2 && block[0].length < 2) || (box instanceof HTMLTextAreaElement && !text.includes('\t'))) return;
      const td = box.closest('td');
      const key = td?.closest('tr')?.dataset['line'];
      if (!td || !key || !rows.has(key)) return;
      event.preventDefault();
      event.stopPropagation();
      pasteBlock(key, td.dataset['column'] ?? '', block);
    },
    true
  );
  /**
   * A block pasted on a dropdown cell, which takes no typing: no browser sends a paste there. Ctrl or ⌘ and V on one
   * moves the focus to a box of the table's own, out of sight, as the keys go down — the browser pastes into it, in every
   * engine — and the block spreads from that cell as from a text cell's, one value too (a choice by its words); the
   * dropdown has the focus back. Nothing pasted (an empty clipboard), it has it back as the keys come up.
   */
  const catcher = make('textarea', { class: 'fd-lines-paste-catcher', tabindex: '-1', 'aria-hidden': 'true' }) as HTMLTextAreaElement;
  let catching: HTMLSelectElement | null = null;
  body.addEventListener('keydown', (event) => {
    const box = event.target as HTMLElement;
    if (readonly || !(box instanceof HTMLSelectElement) || event.key.toLowerCase() !== 'v' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    catching = box;
    catcher.value = '';
    catcher.focus({ preventScroll: true });
  });
  const caught = () => {
    const box = catching;
    catching = null;
    box?.focus({ preventScroll: true });
    return box;
  };
  catcher.addEventListener('paste', (event) => {
    event.preventDefault();
    const box = caught();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const td = box?.closest('td');
    const key = td?.closest('tr')?.dataset['line'];
    if (text && td && key && rows.has(key)) pasteBlock(key, td.dataset['column'] ?? '', blockOf(text));
  });
  catcher.addEventListener('keyup', () => catching && caught());
  element.append(catcher);
  // The note goes once the person moves on: a key in a cell, or the table left.
  body.addEventListener('keydown', (event) => {
    if (!pasteNote.hidden && !(event.ctrlKey || event.metaKey)) pasteNote.hidden = true;
  });
  element.addEventListener('focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null)) pasteNote.hidden = true;
  });

  function makeCell(tr: HTMLTableRowElement, line: Line, column: string, sub: LineField, span = 1) {
    const cellId = `${id}-${line.key}-${column}`;
    // A cell the page draws as a pill in its tone (Flectra's widget="badge"), never edited, or with a widget of its own.
    const rules = lineKind(def, line.values) ? undefined : node.cells?.[column];
    // Its settings reach its widget even without a widget named: a calendar's week numbers.
    const look = rules?.badge ? { widget: 'badge' } : rules?.widget ? { widget: rules.widget, ...(rules.options ? { options: rules.options } : {}) } : rules?.options ? { options: rules.options } : {};
    const subNode: FieldNode = { type: 'field', id: `${node.id}.${line.key}.${column}`, field: column, ...look };
    const widget = create({ form: lineForm(form, name, line.key), name: column, field: sub as Field, node: subNode, id: cellId, document, labels, locale, dialogs, widgets, onError });
    const td = document.createElement('td');
    td.colSpan = span;
    td.dataset['column'] = column;
    if (FIXED_WIDTH.has(sub.type)) td.dataset['fit'] = sub.type;
    // Its words one thing, kept on one line on paper: a number, an amount, a day, a phone number.
    if (keepsWhole(sub.type, subNode.widget)) td.classList.add('fd-whole');
    // Its column's label, which a card shows before its value.
    td.dataset['label'] = sub.label;
    const label = document.createElement('label');
    label.className = 'fd-sr-only';
    label.htmlFor = cellId;
    label.textContent = sub.label;
    // Its message, linked to its box (aria-describedby), and said once, politely, when leaving the cell finds it.
    const error = document.createElement('div');
    error.className = 'fd-cell-error';
    error.id = `${cellId}-error`;
    error.hidden = true;
    td.append(label, widget.element, error);
    tr.append(td);
    const path = `${name}.${line.key}.${column}`;
    td.addEventListener('focusin', () => error.removeAttribute('aria-live'));
    td.addEventListener('focusout', (event) => {
      if (td.contains(event.relatedTarget as Node | null)) return;
      // The cell's own problem — text that does not read, min, max, a whole number — is said now; required waits for Save.
      // Left for a press elsewhere, once that press has ended: nothing moves under it (press.ts).
      afterPress(td.ownerDocument, td, () => {
        if (td.contains(td.ownerDocument.activeElement)) return;
        leaving = path;
        try {
          form.boxLeft(path);
        } finally {
          leaving = null;
        }
      });
    });
    return { name: column, def: sub, widget, error, td };
  }

  function makeRow(line: Line): Row {
    const tr = document.createElement('tr');
    tr.dataset['line'] = line.key;
    const kind = lineKind(def, line.values);
    if (kind) tr.className = `fd-line-${kind}`;
    // Dragged by its grip, the line follows the pointer and takes its place when let go.
    const grip = make('span', { class: 'fd-line-grip fd-rank-grip', 'aria-hidden': 'true' });
    let drag: Drag | null = null;
    grip.addEventListener('pointerdown', (event) => {
      if (readonly || event.button !== 0) return;
      event.preventDefault();
      grip.setPointerCapture?.(event.pointerId);
      drag = lift(tr, line.key, event.clientY);
    });
    grip.addEventListener('pointermove', (event) => drag?.follow(event.clientY));
    grip.addEventListener('pointerup', () => {
      drag?.drop();
      drag = null;
    });
    grip.addEventListener('pointercancel', () => {
      drag?.settle();
      drag = null;
    });
    // Its tick for the table's buttons for chosen lines, before the grip.
    const pick = choosing && !kind ? (make('input', { type: 'checkbox', class: 'fd-checkbox fd-line-pick' }) as HTMLInputElement) : null;
    pick?.addEventListener('change', () => {
      if (pick.checked) chosen.add(line.key);
      else chosen.delete(line.key);
      showChosen();
    });
    tr.append(make('td', { class: 'fd-lines-grip' }, ...(pick ? [make('span', { class: 'fd-line-lead' }, pick, grip)] : [grip])));
    // Its ↑ and ↓, shown on its card only (styles-lines.ts): in a table the grip and Alt+↑/↓ move it. Pressed, the line
    // moves a place, said aloud; the focus stays on the button pressed — on the other one where the line has reached an
    // end, as that one is hidden there.
    const moves = cards === 'never' ? null : { up: make('button', { type: 'button', class: 'fd-line-move', 'data-move': 'up' }, '↑') as HTMLButtonElement, down: make('button', { type: 'button', class: 'fd-line-move', 'data-move': 'down' }, '↓') as HTMLButtonElement };
    for (const [button, by] of moves ? ([[moves.up, -1], [moves.down, 1]] as const) : []) {
      button.addEventListener('click', () => {
        const had = document.activeElement === button;
        move(line.key, current().findIndex((l) => l.key === line.key) + by);
        if (had && button.hidden) (button === moves?.up ? moves.down : moves?.up)?.focus();
      });
    }
    const cells =
      kind && kinds
        ? [makeCell(tr, line, kinds.text, kindTextField(def.fields[kinds.text], kind), columns.length)]
        : columns.map((column) => makeCell(tr, line, column, def.fields[column]));
    const tools = document.createElement('td');
    tools.className = 'fd-lines-tools';
    if (moves) tools.append(moves.up, moves.down);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'fd-line-delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', labels.deleteLine);
    remove.addEventListener('click', () => {
      const asking = options['confirmDelete'] === true;
      // What is typed in the line is part of it: read first, as leaving its cell reads it — a name still looked up is
      // kept unread at once meanwhile ("still looking for …"), so it asks too.
      if (asking) void form.settle?.();
      const at = current().findIndex((l) => l.key === line.key);
      if (at < 0) return;
      const values = current()[at].values;
      const typed = Object.keys(form.getState().unread ?? {}).some((path) => path.startsWith(`${name}.${line.key}.`));
      if (!asking || (!typed && cells.every((cell) => isEmpty(cell.def, values[cell.name]) || values[cell.name] === false))) return form.removeLine(name, line.key);
      confirm.ask(fillIn(labels.removeAsk, { name: fillIn(labels.lineN, { n: itemNumber(current(), line.key, isItem) || at + 1 }) }), (gone) => {
        if (gone) form.removeLine(name, line.key);
        // The line that took its place, or this one kept; else Add.
        const left = current();
        const next = left[gone ? Math.min(at, left.length - 1) : at];
        (next ? rows.get(next.key)?.remove : adds.querySelector('button'))?.focus();
      });
    });
    // The line's own buttons, each shown by its condition on the line; a press runs with the line.
    const buttons = new Map<string, HTMLButtonElement>();
    for (const own of kind ? [] : (node.rowButtons ?? [])) {
      const icon = drawIcon(document, own.icon);
      const button = make('button', { type: 'button', class: `fd-button fd-button-link fd-line-button${icon ? ' fd-line-button-icon' : ''}`, 'data-row-button': own.id, 'aria-label': own.label, title: own.label });
      button.append(icon ?? own.label);
      button.addEventListener('click', async () => {
        if (button.hasAttribute('aria-busy')) return;
        button.setAttribute('aria-busy', 'true');
        try {
          await form.runRowAction(node.id, own.id, line.key);
        } finally {
          button.removeAttribute('aria-busy');
        }
      });
      buttons.set(own.id, button);
      tools.append(button);
    }
    // A copy of the line, its values too, right after it: never its saved id or its place in the order.
    const copy = options['copy'] === true && !kind ? (make('button', { type: 'button', class: 'fd-line-copy' }, '⧉') as HTMLButtonElement) : null;
    copy?.addEventListener('click', () => {
      const all = current();
      const at = all.findIndex((l) => l.key === line.key);
      if (readonly || at < 0 || all.length >= max) return;
      // A line field that says copy: false starts as a new line's does (lineCopy).
      const made = form.addLine(name, lineCopy(def, all[at].values));
      moveLineTo(form, name, def, made, at + 1);
      rows.get(made)?.cells[0]?.widget.focus();
    });
    if (copy) tools.append(copy);
    // Its own page, its own form (lineForm), or its every field, in a dialog (lineOpens).
    if ((node.lineOpens || node.lineForm) && dialogs && !kind) {
      const open = make('button', { type: 'button', class: 'fd-line-open', 'aria-label': labels.openLine, title: labels.openLine }, '↗') as HTMLButtonElement;
      open.addEventListener('click', () => {
        const now = current().find((l) => l.key === line.key);
        // Titled as one line, by its words, else by its number ("Line 3"): never by the table's plural.
        if (now) void openLineDialog(form, name, node, now, dialogs, readonly, (read) => wordsOf(read) || capital(fillIn(labels.lineN, { n: itemNumber(current(), read.key, isItem) })));
      });
      tools.append(open);
    }
    tools.append(remove);
    tr.append(tools);
    return { element: tr, kind, cells, remove, grip, moves, buttons, pick, copy };
  }

  return {
    element,
    focus: () => (body.querySelector<HTMLElement>('input, select, textarea') ?? adds.querySelector('button'))?.focus(),
    destroy: () => {
      destroyed = true;
      for (const row of rows.values()) for (const cell of row.cells) cell.widget.destroy?.();
    },
    update(state) {
      readonly = state.readonly;
      const current = (state.value as Line[] | null) ?? [];
      // Each written only once it changes: a key in the record's header writes none of them (0.35.1).
      setHidden(adds, readonly || current.length >= max);
      if (readonly) setHidden(confirm.element, true);
      if (empty) setHidden(empty, current.length > 0);
      const { errors, unread } = form.getState();
      // Columns the record hides now: their head, cells and total go with them.
      const gone = new Set(ruled ? columns.filter((column) => form.columnHidden(node.id, column)) : []);
      for (const [column, th] of heads) setHidden(th, gone.has(column));
      for (const [column, td] of footCells) setHidden(td, gone.has(column));
      // A column of words or links as wide as its longest value, as a list of words is: a long name has the room a code does not need.
      // Measured as lines come and go, not as a cell is typed in: the columns never move under the person's hands.
      const sizedFor = current.map((line) => line.key).join(' ');
      const resize = sizedFor !== columnsSizedFor;
      columnsSizedFor = sizedFor;
      for (const [column, th] of resize ? heads : new Map<string, HTMLTableCellElement>()) {
        if (node.cells?.[column]?.width) continue;
        const sub = def.fields[column];
        if (th.dataset['fit']) {
          const dated = sub.type === 'date' || sub.type === 'datetime';
          if (!NUMERIC.has(sub.type) && !dated) continue;
          const widest = current.reduce((most, line) => (lineKind(def, line.values) ? most : Math.max(most, cellText(sub, line.values[column], line.values, locale).length)), 0);
          // A number keeps its kind's width at the least, and has room for its longest value too ("E£ 21,600,000.00"), never cut.
          // A day, or a day and its time, likewise: as its box writes it — its pattern where it is empty ("dd/mm/yyyy") —
          // beside the box's calendar button, so a date is never cut ("14 Mar 20…"), in its language's words; the head's
          // letters a little smaller than the cells', so a little more.
          const need = dated ? `calc(${Math.max(widest, dateShape(sub.type as 'date' | 'datetime', dateOrderOf(form), labels).length) + 2}ch + 4.5em)` : `${widest + 4}ch`;
          th.style.setProperty('--fd-fit-need', need);
          continue;
        }
        const longest = current.reduce((most, line) => (lineKind(def, line.values) ? most : Math.max(most, cellText(sub, line.values[column], line.values, locale).length)), 0);
        // A link's box holds its open and clear buttons too.
        const buttons = sub.type === 'many2one' ? 5 : 0;
        // Its head may wrap: a long label over short codes does not widen it.
        th.style.width = `${Math.min(Math.max(longest, Math.min(sub.label.length, 10), 6), 32) + 4 + buttons}ch`;
        // Short values keep their whole width when the table is tight: the long ones give way.
        th.style.minWidth = `${Math.min(Math.max(longest, 6), 14) + 4}ch`;
      }
      const keep = new Set(current.map((line) => line.key));
      for (const [key, row] of rows) {
        if (!keep.has(key)) {
          row.element.remove();
          rows.delete(key);
          // Its cells' widgets go with it, and what they gave the form (a reader of what is typed) with them.
          for (const cell of row.cells) cell.widget.destroy?.();
        }
      }
      // Each line's number as people count lines, worked out once for all of them (0.34 counted the lines before each
      // line again for every line: 20,000 steps a change at 200 lines).
      const numbers = new Map<string, number>();
      let items = 0;
      for (const line of current) numbers.set(line.key, isItem(line) ? ++items : 0);
      // What every line is drawn with: the table's state, the record's fields its money reads its currency from, and the
      // words it is drawn in (a language's that came late: every line drawn again in them).
      const fullState = form.getState();
      const table: string = JSON.stringify([readonly, current.length <= min, current.length >= max, [...gone], parentReads.map((field) => state.values[field] ?? null), wordsVersion()]);
      const redrawAll = full || table !== drawnFor || (appDrawn && state.values !== drawnRecord);
      drawnFor = table;
      drawnRecord = state.values;
      // What the record holds for each line, by its key: its problems, its text that does not read, the choices the app
      // gave it, the options taken out of them and its uploads — each line's own, read once for every line.
      const perLine = linesOwn(fullState);
      current.forEach((line, index) => {
        let row = rows.get(line.key);
        // A line that changed kind is drawn afresh.
        if (row && row.kind !== lineKind(def, line.values)) {
          row.element.remove();
          for (const cell of row.cells) cell.widget.destroy?.();
          row = undefined;
        }
        if (!row) {
          row = makeRow(line);
          rows.set(line.key, row);
        }
        if (body.children[index] !== row.element) body.insertBefore(row.element, body.children[index] ?? null);
        const number = numbers.get(line.key) ?? 0;
        if (row.moves) placeMoves(row.moves, line, index, current.length, number);
        const now = ruled ? form.lineState(node.id, line.key) : null;
        // Drawn again only where something it is drawn from changed: its values, its rules, what the record holds for it,
        // its options where they follow the record — or the table's own state. A key anywhere in the form drew every cell
        // of every line again before (1,000 cells a key at 200 lines).
        const own = perLine.get(line.key);
        const inputs = [now ? JSON.stringify(now) : '', own ? JSON.stringify(own.said) : '', ...(own?.held ?? []), ...offeredOf(line), leaving?.startsWith(`${name}.${line.key}.`) ? leaving : ''];
        if (!redrawAll && row.values && sameValues(row.values, line.values) && sameInputs(row.inputs, inputs)) {
          // Its cells as they were: only its number, where a line before it came or went, said again.
          if (row.number !== number) named(row, number);
          return;
        }
        row.values = line.values;
        row.inputs = inputs;
        // A line the table keeps (lineDelete) shows no ×.
        setHidden(row.remove, readonly || current.length <= min || now?.deletable === false);
        setHidden(row.grip, readonly);
        // Named by its number now, as people count lines (sections and notes are not lines): it moves.
        named(row, number);
        if (row.copy) setHidden(row.copy, readonly || current.length >= max);
        if (readonly) row.remove.remove();
        else if (!row.remove.isConnected) row.element.lastElementChild?.append(row.remove);
        setData(row.element, 'tone', now?.tone);
        row.element.classList.toggle('fd-line-bold', !!now?.bold);
        // A line's buttons act on the saved line, so a read-only table keeps them, as the grid and Flectra's lists do.
        for (const [id, button] of row.buttons) setHidden(button, !now?.buttons[id]);
        // A section's or note's one cell spans the columns shown.
        if (row.kind && row.cells[0].td.colSpan !== columns.length - gone.size) row.cells[0].td.colSpan = columns.length - gone.size;
        for (const cell of row.cells) {
          const message = errors[`${name}.${line.key}.${cell.name}`];
          const rules = row.kind ? undefined : now?.cells[cell.name];
          if (!row.kind) setHidden(cell.td, gone.has(cell.name));
          // A number worked out on a line where a cell holds text that does not read waits for it, as the totals do: a dash
          // with its words, never the amount worked out before that text was typed.
          const waits = row.kind ? null : waitsOn(line, cell.name, unread);
          if (waits) {
            cell.waiting ??= make('span', { class: 'fd-cell-waits' });
            if (cell.waiting.title !== waits) waitingTotal(cell.waiting, waits);
            if (!cell.waiting.isConnected) cell.widget.element.after(cell.waiting);
          } else cell.waiting?.remove();
          // Hidden by its line, the cell stays, empty, so the column lines up.
          cell.widget.element.hidden = !!rules?.invisible || !!waits;
          setData(cell.td, 'tone', rules?.tone);
          cell.td.classList.toggle('fd-cell-bold', !!rules?.bold);
          const path = `${name}.${line.key}.${cell.name}`;
          // Raised by leaving the cell, it is said once, politely; a refused Save's announcer says the rest, once.
          if (leaving === path && message && message !== cell.error.textContent) cell.error.setAttribute('aria-live', 'polite');
          cell.error.hidden = !message;
          if (cell.error.textContent !== (message ?? '')) cell.error.textContent = message ?? '';
          cell.widget.update({
            value: line.values[cell.name],
            values: line.values,
            parent: state.values,
            // A value worked out from the line's others is shown, never typed.
            readonly: readonly || cell.def.readonly === true || cell.def.compute !== undefined || !!rules?.readonly,
            required: cell.def.required === true || !!rules?.required,
            invalid: !!message,
            ...(message ? { describedBy: cell.error.id } : {}),
          });
        }
      });
      for (const [column, td] of sums) {
        // Numbers only: a line holding text that does not read, or no number, makes the total wait for it.
        const total = columnTotal(current, column, isItem, (line) => !!unread?.[`${name}.${line.key}.${column}`] || !!waitsOn(line, column, unread));
        if ('waits' in total) {
          const said = fillIn(labels.totalWaits, { n: total.waits });
          if (td.title !== said) waitingTotal(td, said);
          continue;
        }
        td.removeAttribute('title');
        delete td.dataset['waits'];
        const words = cellText(def.fields[column], total.sum, current[0]?.values ?? {}, locale, state.values, node.cells?.[column]);
        if (td.textContent !== words || td.childElementCount) td.textContent = words;
      }
      for (const { id, button } of controls) button.hidden = form.node(id).invisible;
      showChosen();
      if (focusNew && rows.has(focusNew)) {
        rows.get(focusNew)?.cells[0]?.widget.focus();
        focusNew = null;
      }
    },
  };
}

/** A data attribute set, or taken away when there is nothing to say. */
function setData(element: HTMLElement, key: string, value: string | null | undefined) {
  if (value) element.dataset[key] = value;
  else delete element.dataset[key];
}

/**
 * What a person moved, kept where their eye is: its top on the screen as the move was asked (`top`); once it is drawn in
 * its new place, the page scrolled by as much as it moved (inside a dialog, which scrolls on its own, it moves as it is
 * drawn). A focus given back after a move takes no scroll of the browser's own (`preventScroll`): WebKit scrolled to a
 * button it had just put back from a layout not yet worked out, and threw the page to its top (0.36's walk, a line
 * card's ↑ on an iPhone).
 */
export function keepInSight(element: Element | null | undefined, top: number | undefined): void {
  if (element?.isConnected && top !== undefined) element.ownerDocument.defaultView?.scrollBy(0, element.getBoundingClientRect().top - top);
}
