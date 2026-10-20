import type { Field, FieldNode, Form, FormState, Line, LineField, RecordId, Value, Values } from '@fieldia/core';
import { currencyOf } from './display';
import { stillShown, whileShown } from './shown';
import type { WidgetDialogs } from './widgets';

/**
 * What a one2many's lines are edited through, wherever they are drawn: a table
 * of lines (lines-table.ts, in the lines part), a grid (@fieldia/grid) and
 * cards (cards.ts) — the form a cell sees, a column's total, a line opened in
 * a dialog. In the main script: the grid and the cards draw with them while a
 * page has no table of lines.
 */

/** A column's total: the sum of its lines' numbers, or the line (counted from 1, as the table names them) it waits for. */
export type ColumnTotal = { sum: number } | { waits: number };

/**
 * A line's number as people count lines: its place among the items, from 1. A
 * section or a note is a heading or words between them, never a line of its
 * own: it has none (0), and the line after "Workstations" is line 1. Every
 * message that names a line by its number counts this way.
 */
export function itemNumber(lines: readonly Line[], key: string, isItem: (line: Line) => boolean): number {
  let n = 0;
  for (const line of lines) {
    if (!isItem(line)) continue;
    n++;
    if (line.key === key) return n;
  }
  return 0;
}

/**
 * A column's total over a table's lines. It adds only numbers: a cell holding
 * text that does not read (`unread`), or a value that is no number (words from
 * a server, an old draft), makes the total wait for that line — never NaN,
 * never a confident 0.00 worked out without it. Sections and notes
 * (`isItem` false) hold no amounts. Shared with @fieldia/grid.
 */
export function columnTotal(lines: readonly Line[], column: string, isItem: (line: Line) => boolean, unread: (line: Line) => boolean): ColumnTotal {
  let sum = 0;
  let n = 0;
  for (const line of lines) {
    if (!isItem(line)) continue;
    n++;
    const value = line.values[column];
    if (unread(line) || (value !== null && value !== undefined && value !== '' && (typeof value !== 'number' || !Number.isFinite(value)))) return { waits: n };
    if (typeof value === 'number') sum += value;
  }
  return { sum };
}

/** A total that waits for a line: a dash, said in words to a screen reader and on pointing at it. */
export function waitingTotal(cell: HTMLElement, words: string): void {
  const document = cell.ownerDocument;
  const dash = document.createElement('span');
  dash.setAttribute('aria-hidden', 'true');
  dash.textContent = '—';
  const said = document.createElement('span');
  said.className = 'fd-sr-only';
  said.textContent = words;
  cell.replaceChildren(dash, said);
  cell.title = words;
  cell.dataset['waits'] = '';
}

/** The field a section or note is typed into: one line for a heading, a growing box for a note. */
export function kindTextField(def: LineField, kind: 'section' | 'note'): LineField {
  return kind === 'section' ? ({ ...def, type: 'char' } as LineField) : ({ ...def, type: 'text' } as LineField);
}

/** The columns of a table whose choices are one of the app's lists, each line's its own. */
const listedOf = (form: Form, field: string): string[] => {
  const def = form.page.fields[field];
  return def?.type === 'one2many' ? Object.keys(def.fields).filter((column) => def.fields[column].type === 'selection' && !!(def.fields[column] as { optionsFrom?: unknown }).optionsFrom) : [];
};

/** The form a cell sees: the line's values, written back into the line. Shared with @fieldia/grid. */
export function lineForm(form: Form, field: string, key: string): Form {
  const line = () => ((form.getState().values[field] as Line[] | null) ?? []).find((l) => l.key === key);
  const values = () => line()?.values ?? {};
  // A cell's unread text is kept by its path in the record's form (`field.key.column`): the cell sees its own by its column.
  const at = `${field}.${key}.`;
  const unread = () => Object.fromEntries(Object.entries(form.getState().unread ?? {}).flatMap(([path, text]) => (path.startsWith(at) ? [[path.slice(at.length), text]] : [])));
  // A choice from the app's list is the line's own, kept by its cell's path as well.
  const listed = listedOf(form, field);
  const choices = (all: FormState['choices']) => Object.fromEntries(listed.flatMap((column) => (all[at + column] ? [[column, all[at + column]]] : [])));
  return {
    ...form,
    getState: (): FormState => {
      const state = form.getState();
      return { ...state, values: values(), unread: unread(), ...(listed.length ? { choices: choices(state.choices) } : {}) };
    },
    // Asked while the line is there: a cell of a line taken away asks nothing.
    loadChoices: (name: string) => (!listed.includes(name) ? form.loadChoices(name) : line() ? form.loadChoices(at + name) : undefined),
    setValue: (name: string, value: Value) => form.updateLine(field, key, name, value),
    setUnread: (name: string, text) => form.setUnread(`${at}${name}`, text),
    boxLeft: (name: string) => form.boxLeft(`${at}${name}`),
    search: (name: string, query: string, limit?: number, options?: { model?: string; ids?: RecordId[] }) => form.searchLine(field, key, name, query, limit, options),
    canCreate: (name: string) => form.canCreateLine(field, name),
    quickCreate: (name: string, text: string) => form.quickCreateLine(field, name, text, key),
    createValues: (name: string) => form.createValues(name, { lines: field, key }),
    // A file picked in a cell goes to the store as this line's, and the cell shows this line's on their way.
    upload: (name: string, files: Parameters<Form['upload']>[1], how: Parameters<Form['upload']>[2] = {}) => form.upload(name, files, { ...how, line: { field, key } }),
    uploading: (name: string) => form.getState().uploads.filter((upload) => upload.field === name && upload.line?.field === field && upload.line.key === key),
  };
}

/**
 * A line's column as its cell reads at rest — the grid's, a printout's, the plain words before the lines part: a choice
 * from the app's list with the choices loaded for that line, its value said by its label. Shared with @fieldia/grid.
 */
export function lineColumn(form: Form, field: string, key: string, column: string, sub: LineField): LineField {
  if (sub.type !== 'selection' || !sub.optionsFrom) return sub;
  const options = form.getState().choices[`${field}.${key}.${column}`]?.options;
  return options ? ({ ...sub, options } as LineField) : sub;
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
export async function openLineDialog(form: Form, name: string, node: FieldNode, pressed: Line, dialogs: WidgetDialogs, readonly: boolean): Promise<void> {
  const def = form.page.fields[name] as Extract<Field, { type: 'one2many' }>;
  const lines = () => (form.getState().values[name] as Line[] | null) ?? [];
  // What is still typed in a cell is read first — a name looked up (the cell left as the line was opened) waited for —
  // so the dialog shows the line as it reads, and its Save & Close never writes back what the typing replaced.
  const asked = stillShown(form);
  const own = form.page.lowerLabels;
  const lowerLabels = own === undefined ? {} : { lowerLabels: own };
  const settling = form.settle?.();
  if (form.reading?.()) await settling;
  const line = lines().find((l) => l.key === pressed.key);
  // Taken away, or another record shown, meanwhile: nothing to open.
  if (!line || !asked()) return;
  // Its answer is for the record it was opened on: written back only while that one is still shown, never on a line of
  // another (two records' lines may have the same key).
  const write = whileShown(form, (values: Values) => form.setValue(name, lines().map((l) => (l.key === line.key ? { ...l, values: { ...l.values, ...values } } : l))));
  const shown = stillShown(form);
  if (node.lineOpens === 'record' && line.id !== undefined && dialogs.canOpen(def.relation)) {
    // A line is part of its record: its labels said as the record's page asks, unless its own page says otherwise.
    const saved = await dialogs.openRecord(def.relation, { recordId: line.id, title: def.label, withValues: true, ...lowerLabels });
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
  // Laid out by the table's lineForm when it has one, its conditions reading the line, its record as parent.
  const state = form.getState();
  const values = await dialogs.editValues({
    title: def.label,
    fields,
    values: line.values,
    readonly,
    // Worked out on its own line while its record is shown; after, as it is.
    recompute: (edited) => (shown() ? form.previewLine(name, line.key, edited) : Promise.resolve(edited)),
    parent: { values: state.values, fields: form.page.fields, id: state.recordId },
    ...(node.lineForm ? { layout: node.lineForm.children } : {}),
    ...lowerLabels,
  });
  // Written in one go, so the form recalculates once.
  if (values) write(values);
}
