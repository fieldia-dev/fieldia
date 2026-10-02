import type { Field, FieldNode, Form, FormState, Line, LineField, Value } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/**
 * A one2many as an editable table. Each cell is an ordinary widget; a small
 * adapter routes its edits to `updateLine` and its searches to `searchLine`,
 * so a many2one inside a line searches with that line's own values. Rows are
 * matched by line key, so adding or removing a line never rebuilds the others.
 */

interface Row {
  element: HTMLTableRowElement;
  cells: { name: string; def: LineField; widget: Widget; error: HTMLElement }[];
  remove: HTMLButtonElement;
}

/** The form a cell sees: the line's values, written back into the line. Shared with @fieldia/grid. */
export function lineForm(form: Form, field: string, key: string): Form {
  const values = () => (((form.getState().values[field] as Line[] | null) ?? []).find((l) => l.key === key)?.values ?? {});
  return {
    ...form,
    getState: (): FormState => ({ ...form.getState(), values: values() }),
    setValue: (name: string, value: Value) => form.updateLine(field, key, name, value),
    search: (name: string, query: string, limit?: number) => form.searchLine(field, key, name, query, limit),
  };
}

export const linesWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en }) => {
  const def = field as Extract<Field, { type: 'one2many' }>;
  const columns = (node.columns ?? Object.keys(def.fields)).filter((column) => def.fields[column]);
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
  scroller.append(table);
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'fd-button fd-button-link fd-lines-add';
  add.textContent = `+ ${labels.addLine}`;
  element.append(scroller, add);

  const rows = new Map<string, Row>();
  let focusNew: string | null = null;
  let readonly = false;

  add.addEventListener('click', () => {
    focusNew = form.addLine(name);
    const row = rows.get(focusNew);
    if (row) {
      row.cells[0]?.widget.focus();
      focusNew = null;
    }
  });

  function makeRow(line: Line): Row {
    const tr = document.createElement('tr');
    tr.dataset['line'] = line.key;
    const adapter = lineForm(form, name, line.key);
    const cells = columns.map((column) => {
      const sub = def.fields[column];
      const cellId = `${id}-${line.key}-${column}`;
      const subNode: FieldNode = { type: 'field', id: `${node.id}.${line.key}.${column}`, field: column };
      const widget = createWidget({ form: adapter, name: column, field: sub as Field, node: subNode, id: cellId, document, labels });
      const td = document.createElement('td');
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
    });
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
    return { element: tr, cells, remove };
  }

  return {
    element,
    focus: () => (body.querySelector<HTMLElement>('input, select, textarea') ?? add).focus(),
    update(state) {
      readonly = state.readonly;
      add.hidden = readonly;
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
      if (focusNew && rows.has(focusNew)) {
        rows.get(focusNew)?.cells[0]?.widget.focus();
        focusNew = null;
      }
    },
  };
};
