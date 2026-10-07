import { isEmpty, lineKind, type Field, type FieldNode, type Form, type FormState, type Line, type LineField, type Value, type Values } from '@fieldia/core';
import { cellText, currencyOf } from './display';
import { drawIcon } from './icons';
import { askFirst, fillIn, maker } from './kind-parts';
import { WIDGET_LABELS } from './labels';
import { moveLineTo } from './line-moves';
import { createWidget, type Widget, type WidgetDialogs, type WidgetFactory } from './widgets';

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
  cells: { name: string; def: LineField; widget: Widget; error: HTMLElement; td: HTMLTableCellElement }[];
  /** The line's own buttons, by their id. */
  buttons: Map<string, HTMLButtonElement>;
  remove: HTMLButtonElement;
  grip: HTMLElement;
  /** The tick that chooses the line for the table's buttons for chosen lines; none without them, or on a section or note. */
  pick: HTMLInputElement | null;
  /** The button that puts a copy of the line right after it (`options.copy`). */
  copy: HTMLButtonElement | null;
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
    quickCreate: (name: string, text: string) => form.quickCreateLine(field, name, text, key),
    createValues: (name: string) => form.createValues(name, { lines: field, key }),
  };
}

/** A line's money in its record's currency (`parent.…`), as a field of its own: in that currency, fixed — for a dialog with no record round it. */
export function ownCurrency(sub: LineField, parent: Readonly<Values>): LineField {
  if (sub.type !== 'monetary' || !sub.currencyField?.startsWith('parent.')) return sub;
  const { currencyField: _, ...rest } = sub;
  const code = currencyOf(sub, {}, parent);
  return code && /^[A-Z]{3}$/.test(code) ? { ...rest, currency: code } : rest;
}

/**
 * A line opened in a dialog: with `lineOpens: "record"`, a saved line's own
 * record by the table's model — what its page saved is written back to the
 * line's fields of the same names — else, or for a line not saved yet, every
 * one of its fields, recalculated as they change and written back on Save &
 * Close. Shared with @fieldia/grid.
 */
export async function openLineDialog(form: Form, name: string, node: FieldNode, line: Line, dialogs: WidgetDialogs, readonly: boolean): Promise<void> {
  const def = form.page.fields[name] as Extract<Field, { type: 'one2many' }>;
  const lines = () => (form.getState().values[name] as Line[] | null) ?? [];
  const write = (values: Values) => form.setValue(name, lines().map((l) => (l.key === line.key ? { ...l, values: { ...l.values, ...values } } : l)));
  if (node.lineOpens === 'record' && line.id !== undefined && dialogs.canOpen(def.relation)) {
    const saved = await dialogs.openRecord(def.relation, { recordId: line.id, title: def.label, withValues: true });
    const back = Object.fromEntries(Object.entries(saved?.values ?? {}).filter(([key]) => key in def.fields && key !== def.sequenceField));
    if (Object.keys(back).length) write(back as Values);
    return;
  }
  const fields = Object.fromEntries(
    Object.entries(def.fields)
      .filter(([key]) => key !== def.lineKinds?.field && key !== def.sequenceField)
      .map(([key, sub]) => [key, ownCurrency(sub, form.getState().values)])
  ) as Record<string, Field>;
  // The dialog shows what the onchange makes of the line as it is edited; the line itself waits for Save & Close.
  const values = await dialogs.editValues({ title: def.label, fields, values: line.values, readonly, recompute: (edited) => form.previewLine(name, line.key, edited) });
  // Written in one go, so the form recalculates once.
  if (values) write(values);
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
  const heads = new Map<string, HTMLTableCellElement>();
  // The table's own rules, read by the form line by line; a table with none asks nothing.
  const ruled = !!(node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons);
  const columns = (node.columns ?? Object.keys(def.fields)).filter(
    (column) => def.fields[column] && column !== kinds?.field && column !== def.sequenceField && node.optionalColumns?.[column] !== 'hide'
  );
  const element = document.createElement('div');
  element.className = 'fd-lines';
  element.id = id;
  // Lines as cards on a narrow form, or always; columns as wide as they hold: the stylesheet draws them so.
  if (node.cards) element.dataset['cards'] = node.cards;
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
  const confirm = askFirst(make, labels);
  // Where a line went, said politely; not the page's own announcer, which a page looks for by its class.
  const voice = make('div', { class: 'fd-sr-only', role: 'status' });
  element.append(...(bar ? [bar] : []), scroller, ...(empty ? [empty] : []), adds, confirm.element, voice);
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
    bar.hidden = readonly || chosen.size === 0;
    chosenCount.textContent = fillIn(labels.linesChosen, { n: chosen.size });
    for (const { id, button } of chosenButtons) button.hidden = form.node(id).invisible;
    pickAll.checked = items.length > 0 && chosen.size === items.length;
    pickAll.indeterminate = chosen.size > 0 && chosen.size < items.length;
    pickAll.disabled = readonly || !items.length;
    for (const [key, row] of rows) {
      if (!row.pick) continue;
      row.pick.checked = chosen.has(key);
      row.pick.disabled = readonly;
    }
  }
  pickAll?.addEventListener('change', () => {
    const items = current().filter((line) => !lineKind(def, line.values));
    if (pickAll.checked) for (const line of items) chosen.add(line.key);
    else chosen.clear();
    showChosen();
  });

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
    // A cell the page draws as a pill in its tone (Flectra's widget="badge"), never edited, or with a widget of its own.
    const rules = lineKind(def, line.values) ? undefined : node.cells?.[column];
    const look = rules?.badge ? { widget: 'badge' } : rules?.widget ? { widget: rules.widget, ...(rules.options ? { options: rules.options } : {}) } : {};
    const subNode: FieldNode = { type: 'field', id: `${node.id}.${line.key}.${column}`, field: column, ...look };
    const widget = createWidget({ form: lineForm(form, name, line.key), name: column, field: sub as Field, node: subNode, id: cellId, document, labels, locale, dialogs });
    const td = document.createElement('td');
    td.colSpan = span;
    td.dataset['column'] = column;
    // Its column's label, which a card shows before its value.
    td.dataset['label'] = sub.label;
    const label = document.createElement('label');
    label.className = 'fd-sr-only';
    label.htmlFor = cellId;
    label.textContent = sub.label;
    const error = document.createElement('div');
    error.className = 'fd-cell-error';
    error.hidden = true;
    td.append(label, widget.element, error);
    tr.append(td);
    return { name: column, def: sub, widget, error, td };
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
    // Its tick for the table's buttons for chosen lines, before the grip.
    const pick = choosing && !kind ? (make('input', { type: 'checkbox', class: 'fd-checkbox fd-line-pick' }) as HTMLInputElement) : null;
    pick?.addEventListener('change', () => {
      if (pick.checked) chosen.add(line.key);
      else chosen.delete(line.key);
      showChosen();
    });
    tr.append(make('td', { class: 'fd-lines-grip' }, ...(pick ? [make('span', { class: 'fd-line-lead' }, pick, grip)] : [grip])));
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
      const values = { ...all[at].values };
      if (def.sequenceField) delete values[def.sequenceField];
      const made = form.addLine(name, values);
      moveLineTo(form, name, def, made, at + 1);
      rows.get(made)?.cells[0]?.widget.focus();
    });
    if (copy) tools.append(copy);
    // Its own page, or its every field, in a dialog (lineOpens).
    if (node.lineOpens && dialogs && !kind) {
      const open = make('button', { type: 'button', class: 'fd-line-open', 'aria-label': labels.openLine, title: labels.openLine }, '↗') as HTMLButtonElement;
      open.addEventListener('click', () => {
        const now = current().find((l) => l.key === line.key);
        if (now) void openLineDialog(form, name, node, now, dialogs, readonly);
      });
      tools.append(open);
    }
    tools.append(remove);
    tr.append(tools);
    return { element: tr, kind, cells, remove, grip, buttons, pick, copy };
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
      // Columns the record hides now: their head, cells and total go with them.
      const gone = new Set(ruled ? columns.filter((column) => form.columnHidden(node.id, column)) : []);
      for (const [column, th] of heads) th.hidden = gone.has(column);
      for (const [column, td] of footCells) td.hidden = gone.has(column);
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
        // Named by where it is now: it moves.
        const lineName = fillIn(labels.lineN, { n: index + 1 });
        row.pick?.setAttribute('aria-label', fillIn(labels.chooseLine, { name: lineName }));
        if (row.copy) {
          row.copy.setAttribute('aria-label', fillIn(labels.copy, { name: lineName }));
          row.copy.title = row.copy.getAttribute('aria-label') as string;
          row.copy.hidden = readonly || current.length >= max;
        }
        if (readonly) row.remove.remove();
        else if (!row.remove.isConnected) row.element.lastElementChild?.append(row.remove);
        const now = ruled ? form.lineState(node.id, line.key) : null;
        setData(row.element, 'tone', now?.tone);
        row.element.classList.toggle('fd-line-bold', !!now?.bold);
        for (const [id, button] of row.buttons) button.hidden = readonly || !now?.buttons[id];
        // A section's or note's one cell spans the columns shown.
        if (row.kind) row.cells[0].td.colSpan = columns.length - gone.size;
        for (const cell of row.cells) {
          const message = errors[`${name}.${line.key}.${cell.name}`];
          const rules = row.kind ? undefined : now?.cells[cell.name];
          if (!row.kind) cell.td.hidden = gone.has(cell.name);
          // Hidden by its line, the cell stays, empty, so the column lines up.
          cell.widget.element.hidden = !!rules?.invisible;
          setData(cell.td, 'tone', rules?.tone);
          cell.td.classList.toggle('fd-cell-bold', !!rules?.bold);
          cell.error.hidden = !message;
          cell.error.textContent = message ?? '';
          cell.widget.update({
            value: line.values[cell.name],
            values: line.values,
            parent: state.values,
            // A value worked out from the line's others is shown, never typed.
            readonly: readonly || cell.def.readonly === true || cell.def.compute !== undefined || !!rules?.readonly,
            required: cell.def.required === true || !!rules?.required,
            invalid: !!message,
          });
        }
      });
      for (const [column, td] of sums) {
        const sum = current.filter((line) => !lineKind(def, line.values)).reduce((total, line) => total + Number(line.values[column] ?? 0), 0);
        td.textContent = cellText(def.fields[column], sum, current[0]?.values ?? {}, locale, state.values, node.cells?.[column]);
      }
      for (const { id, button } of controls) button.hidden = form.node(id).invisible;
      showChosen();
      if (focusNew && rows.has(focusNew)) {
        rows.get(focusNew)?.cells[0]?.widget.focus();
        focusNew = null;
      }
    },
  };
};

/** A data attribute set, or taken away when there is nothing to say. */
function setData(element: HTMLElement, key: string, value: string | null | undefined) {
  if (value) element.dataset[key] = value;
  else delete element.dataset[key];
}
