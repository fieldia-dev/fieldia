import { isEmpty, lineKind, type Field, type FieldNode, type Form, type FormState, type Line, type LineField, type Value } from '@fieldia/core';
import { displayValue } from './display';
import { askFirst, fillIn, maker } from './kind-parts';
import { WIDGET_LABELS } from './labels';
import { moveLineTo } from './line-moves';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/**
 * A one2many as an editable table. Each cell is an ordinary widget; a small
 * adapter routes its edits to `updateLine` and its searches to `searchLine`,
 * so a many2one inside a line searches with that line's own values. Rows are
 * matched by line key, so adding or removing a line never rebuilds the others.
 * When the field declares `lineKinds`, a section or a note is one wide row of
 * its text.
 *
 * A line moves by the grip at its start, or by Alt+↑/↓ from inside it, said
 * aloud. The node's `options`: `min` lines at least — a new table starts with
 * them — and `max` at most; `addLabel`, the Add button's words (and
 * `addSectionLabel`, `addNoteLabel`, its section's and note's); `emptyLabel`,
 * a sentence while there is no line; `confirmDelete`, asking before a line
 * with something in it goes.
 */

interface Row {
  element: HTMLTableRowElement;
  kind: 'section' | 'note' | null;
  cells: { name: string; def: LineField; widget: Widget; error: HTMLElement }[];
  remove: HTMLButtonElement;
  grip: HTMLElement;
}

const count = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined);

/** The field a section or note is typed into: one line for a heading, a growing box for a note. */
export function kindTextField(def: LineField, kind: 'section' | 'note'): LineField {
  return kind === 'section' ? ({ ...def, type: 'char' } as LineField) : ({ ...def, type: 'text' } as LineField);
}

/** The form a cell sees: the line's values, written back into the line. Shared with @fieldia/grid. */
export function lineForm(form: Form, field: string, key: string): Form {
  const values = () => (((form.getState().values[field] as Line[] | null) ?? []).find((l) => l.key === key)?.values ?? {});
  return {
    ...form,
    getState: (): FormState => ({ ...form.getState(), values: values() }),
    setValue: (name: string, value: Value) => form.updateLine(field, key, name, value),
    search: (name: string, query: string, limit?: number) => form.searchLine(field, key, name, query, limit),
    canCreate: (name: string) => form.canCreateLine(field, name),
    quickCreate: (name: string, text: string) => form.quickCreateLine(field, name, text),
  };
}

export const linesWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, locale, dialogs }) => {
  const def = field as Extract<Field, { type: 'one2many' }>;
  const kinds = def.lineKinds;
  const make = maker(document);
  const options = node.options ?? {};
  const min = count(options['min']) ?? 0;
  const max = count(options['max']) ?? Infinity;
  const words = (key: string) => (typeof options[key] === 'string' && (options[key] as string).trim() ? (options[key] as string) : null);
  // The fields that say what a line is and keep the lines' order never show as columns.
  // Optional columns the page starts hidden stay out of the plain table.
  const columns = (node.columns ?? Object.keys(def.fields)).filter(
    (column) => def.fields[column] && column !== kinds?.field && column !== def.sequenceField && node.optionalColumns?.[column] !== 'hide'
  );
  const element = document.createElement('div');
  element.className = 'fd-lines';
  element.id = id;
  element.setAttribute('role', 'group');
  const scroller = document.createElement('div');
  scroller.className = 'fd-lines-scroll';
  const table = document.createElement('table');
  table.className = 'fd-lines-table';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.append(make('th', { class: 'fd-lines-grip' }));
  for (const column of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = def.fields[column].label;
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
  if (totals.length) {
    const foot = document.createElement('tfoot');
    const row = document.createElement('tr');
    row.className = 'fd-lines-totals';
    row.append(document.createElement('td'));
    columns.forEach((column, i) => {
      const td = document.createElement('td');
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
  const emptyWords = words('emptyLabel');
  const empty = emptyWords ? make('div', { class: 'fd-help fd-lines-empty' }, emptyWords) : null;
  // Removing a line with something in it asks first, in place: "Remove line 2?  Remove · Keep".
  const confirm = askFirst(make, labels);
  // Where a line went, said politely; not the page's own announcer, which a page looks for by its class.
  const voice = make('div', { class: 'fd-sr-only', role: 'status' });
  element.append(scroller, ...(empty ? [empty] : []), adds, confirm.element, voice);

  const rows = new Map<string, Row>();
  let focusNew: string | null = null;
  let readonly = false;
  const current = () => (form.getState().values[name] as Line[] | null) ?? [];
  // A new table starts with the lines it needs at least.
  for (let have = current().length; have < min; have++) form.addLine(name);

  /** A line to another place, the focus kept where it was, and where it went said aloud. */
  function move(key: string, to: number) {
    const from = current().findIndex((line) => line.key === key);
    if (readonly || to === from || to < 0 || to >= current().length) return;
    const focused = document.activeElement as HTMLElement | null;
    // Named by its first column's words, else by where it was.
    const first = current()[from].values[columns[0]];
    moveLineTo(form, name, def, key, to);
    if (focused && focused !== document.activeElement) focused.focus();
    voice.textContent = fillIn(labels.movedTo, { label: typeof first === 'string' && first.trim() ? first : fillIn(labels.lineN, { n: from + 1 }), n: to + 1, total: current().length });
  }
  body.addEventListener('keydown', (event) => {
    const key = (event.target as Element).closest('tr')?.dataset['line'];
    if (!key || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    move(key, current().findIndex((line) => line.key === key) + (event.key === 'ArrowUp' ? -1 : 1));
  });
  function makeCell(tr: HTMLTableRowElement, line: Line, column: string, sub: LineField, span = 1) {
    const cellId = `${id}-${line.key}-${column}`;
    const subNode: FieldNode = { type: 'field', id: `${node.id}.${line.key}.${column}`, field: column };
    const widget = createWidget({ form: lineForm(form, name, line.key), name: column, field: sub as Field, node: subNode, id: cellId, document, labels, locale, dialogs });
    const td = document.createElement('td');
    td.colSpan = span;
    const label = document.createElement('label');
    label.className = 'fd-sr-only';
    label.htmlFor = cellId;
    label.textContent = sub.label;
    const error = document.createElement('div');
    error.className = 'fd-cell-error';
    error.hidden = true;
    td.append(label, widget.element, error);
    tr.append(td);
    return { name: column, def: sub, widget, error };
  }

  function makeRow(line: Line): Row {
    const tr = document.createElement('tr');
    tr.dataset['line'] = line.key;
    const kind = lineKind(def, line.values);
    if (kind) tr.className = `fd-line-${kind}`;
    // Dragged by its grip, the line takes the place the pointer is at.
    const grip = make('span', { class: 'fd-line-grip fd-rank-grip', 'aria-hidden': 'true' });
    let dragging = false;
    grip.addEventListener('pointerdown', (event) => {
      if (readonly || event.button !== 0) return;
      event.preventDefault();
      grip.setPointerCapture?.(event.pointerId);
      dragging = true;
    });
    grip.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      // The place among the others: as many as have their middle above the pointer.
      move(line.key, [...body.children].filter((row) => row !== tr && row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 < event.clientY).length);
    });
    for (const end of ['pointerup', 'pointercancel']) grip.addEventListener(end, () => (dragging = false));
    tr.append(make('td', { class: 'fd-lines-grip' }, grip));
    const cells =
      kind && kinds
        ? [makeCell(tr, line, kinds.text, kindTextField(def.fields[kinds.text], kind), columns.length)]
        : columns.map((column) => makeCell(tr, line, column, def.fields[column]));
    const tools = document.createElement('td');
    tools.className = 'fd-lines-tools';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'fd-line-delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', labels.deleteLine);
    remove.addEventListener('click', () => {
      const at = current().findIndex((l) => l.key === line.key);
      const values = current()[at]?.values ?? {};
      if (options['confirmDelete'] !== true || cells.every((cell) => isEmpty(cell.def, values[cell.name]) || values[cell.name] === false)) return form.removeLine(name, line.key);
      confirm.ask(fillIn(labels.removeAsk, { name: fillIn(labels.lineN, { n: at + 1 }) }), (gone) => {
        if (gone) form.removeLine(name, line.key);
        // The line that took its place, or this one kept; else Add.
        const left = current();
        const next = left[gone ? Math.min(at, left.length - 1) : at];
        (next ? rows.get(next.key)?.remove : adds.querySelector('button'))?.focus();
      });
    });
    tools.append(remove);
    tr.append(tools);
    return { element: tr, kind, cells, remove, grip };
  }

  return {
    element,
    focus: () => (body.querySelector<HTMLElement>('input, select, textarea') ?? adds.querySelector('button'))?.focus(),
    update(state) {
      readonly = state.readonly;
      const current = (state.value as Line[] | null) ?? [];
      adds.hidden = readonly || current.length >= max;
      if (readonly) confirm.element.hidden = true;
      if (empty) empty.hidden = current.length > 0;
      const errors = form.getState().errors;
      const keep = new Set(current.map((line) => line.key));
      for (const [key, row] of rows) {
        if (!keep.has(key)) {
          row.element.remove();
          rows.delete(key);
        }
      }
      current.forEach((line, index) => {
        let row = rows.get(line.key);
        // A line that changed kind is drawn afresh.
        if (row && row.kind !== lineKind(def, line.values)) {
          row.element.remove();
          row = undefined;
        }
        if (!row) {
          row = makeRow(line);
          rows.set(line.key, row);
        }
        if (body.children[index] !== row.element) body.insertBefore(row.element, body.children[index] ?? null);
        row.remove.hidden = readonly || current.length <= min;
        row.grip.hidden = readonly;
        if (readonly) row.remove.remove();
        else if (!row.remove.isConnected) row.element.lastElementChild?.append(row.remove);
        for (const cell of row.cells) {
          const message = errors[`${name}.${line.key}.${cell.name}`];
          cell.error.hidden = !message;
          cell.error.textContent = message ?? '';
          cell.widget.update({
            value: line.values[cell.name],
            values: line.values,
            // A value worked out from the line's others is shown, never typed.
            readonly: readonly || cell.def.readonly === true || cell.def.compute !== undefined,
            required: cell.def.required === true,
            invalid: !!message,
          });
        }
      });
      for (const [column, td] of sums) {
        const sum = current.filter((line) => !lineKind(def, line.values)).reduce((total, line) => total + Number(line.values[column] ?? 0), 0);
        td.textContent = displayValue(def.fields[column], sum, current[0]?.values ?? {}, locale);
      }
      if (focusNew && rows.has(focusNew)) {
        rows.get(focusNew)?.cells[0]?.widget.focus();
        focusNew = null;
      }
    },
  };
};
