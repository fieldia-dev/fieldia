import { lineKind, type Field, type FieldNode, type Form, type FormState, type Line, type LineField, type Value } from '@fieldia/core';
import { displayValue } from './display';
import { WIDGET_LABELS } from './labels';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/**
 * A one2many as an editable table. Each cell is an ordinary widget; a small
 * adapter routes its edits to `updateLine` and its searches to `searchLine`,
 * so a many2one inside a line searches with that line's own values. Rows are
 * matched by line key, so adding or removing a line never rebuilds the others.
 * When the field declares `lineKinds`, a section or a note is one wide row of
 * its text.
 */

interface Row {
  element: HTMLTableRowElement;
  kind: 'section' | 'note' | null;
  cells: { name: string; def: LineField; widget: Widget; error: HTMLElement }[];
  remove: HTMLButtonElement;
}

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

export const linesWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, locale }) => {
  const def = field as Extract<Field, { type: 'one2many' }>;
  const kinds = def.lineKinds;
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
  addButton(labels.addLine, {}, 'line');
  if (kinds) {
    addButton(labels.addSection, { [kinds.field]: kinds.section ?? 'section' }, 'section');
    addButton(labels.addNote, { [kinds.field]: kinds.note ?? 'note' }, 'note');
  }
  element.append(scroller, adds);

  const rows = new Map<string, Row>();
  let focusNew: string | null = null;
  let readonly = false;

  function makeCell(tr: HTMLTableRowElement, line: Line, column: string, sub: LineField, span = 1) {
    const cellId = `${id}-${line.key}-${column}`;
    const subNode: FieldNode = { type: 'field', id: `${node.id}.${line.key}.${column}`, field: column };
    const widget = createWidget({ form: lineForm(form, name, line.key), name: column, field: sub as Field, node: subNode, id: cellId, document, labels, locale });
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
    remove.addEventListener('click', () => form.removeLine(name, line.key));
    tools.append(remove);
    tr.append(tools);
    return { element: tr, kind, cells, remove };
  }

  return {
    element,
    focus: () => (body.querySelector<HTMLElement>('input, select, textarea') ?? adds.querySelector('button'))?.focus(),
    update(state) {
      readonly = state.readonly;
      adds.hidden = readonly;
      const current = (state.value as Line[] | null) ?? [];
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
        row.remove.hidden = readonly;
        if (readonly) row.remove.remove();
        else if (!row.remove.isConnected) row.element.lastElementChild?.append(row.remove);
        for (const cell of row.cells) {
          const message = errors[`${name}.${line.key}.${cell.name}`];
          cell.error.hidden = !message;
          cell.error.textContent = message ?? '';
          cell.widget.update({
            value: line.values[cell.name],
            values: line.values,
            readonly: readonly || cell.def.readonly === true,
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
