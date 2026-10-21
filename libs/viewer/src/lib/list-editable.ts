import {
  compileModifier,
  editableColumns,
  isRightToLeft,
  labelAt,
  loadedRecord,
  loadedRecordOf,
  optionsList,
  recordSentence,
  type DataSource,
  type Field,
  type FieldNode,
  type Form,
  type FormState,
  type FunctionTable,
  type Line,
  type LineField,
  type ListNode,
  type LoadedRecord,
  type Page,
  type RecordId,
  type RecordVersion,
  type SaveResult,
  type Value,
  type Values,
} from '@fieldia/core';
import { currencyOf, dateOrderOf, linesPart, type LinesPart, type Widget, type WidgetLabels } from '@fieldia/widgets';
import { setAttr, setHidden, setText } from './dom';
import { installEditableStyles } from './editable-styles';
import type { ListContext } from './list';
import type { Cells } from './list-cells';
import type { Row } from './list-groups';
import { saveSafety } from './save-safety';
import { CELL_BOXES } from './viewer-parts';

/**
 * A list whose cells are changed in place (`ListNode.editable`; the editable part): a press on a cell, or Enter, opens
 * it in its field's own box — the box a form draws, with its rules: what can never be valid refused as it is typed,
 * text that does not read kept with why — Tab and Shift+Tab go from cell to cell and on to the next row, Escape puts
 * back what the cell held. Each row is a record's own form (`newForm`): it is saved through the data source as the
 * person leaves it — the fields it changed, as a save of some fields (`partial`) — and one refused stays as typed, why
 * said under it, with Put back; one someone else changed meanwhile is told as a record's page tells it (save-safety.ts:
 * Reload, Keep mine). A row is added at the end, saved once it is left. A block pasted from a spreadsheet goes across
 * the cells and down the rows from the one pasted on, each cell read as its box reads typing (the lines part's
 * readers), each row then saved — rows given the same change written in one `writeMany` where the source has it. On a
 * phone, where the rows are cards, a card's fields are changed in a sheet over the list.
 */

/** The form a row is edited through, as the viewer makes one: its words, its clock, the person, the app's functions. */
export type NewForm = (options: { page: Page; dataSource: DataSource; recordId: RecordId | null; values?: Values }) => Form;

export interface EditableContext {
  /** The list's own, as the viewer gave it: its words, its source, its dialogs, a row's form and a field's box. */
  list: ListContext;
  /** Its page, a choice carried from an earlier question shown by every option it may hold. */
  page: Page;
  model: string;
  /** The fields the list asks of each record: a row's form holds these. */
  reads: readonly string[];
  /** The page's own functions, as its expressions call them. */
  functions?: FunctionTable | undefined;
  /** The record's own words, as the list's cells draw them. */
  cells: Cells;
  nameColumn: string;
  element: HTMLElement;
  body: HTMLTableSectionElement;
  /** The columns shown, in the person's order. */
  columns(): string[];
  /** How many columns a row across the table spans. */
  span(): number;
  /** A record's row as the list draws it (wired again: `wire`), under a parent at `level`. */
  row(record: Row, level?: number): HTMLTableRowElement;
  /** A row saved: what the list knows of its record, its totals; `made`, a record new to the list. */
  saved(record: Row, made: boolean): void;
  /** Ask for the records again. */
  reload(): Promise<void>;
  /** The rows drawn changed: the list's words for none. */
  changed(): void;
  /** Whether the rows are under their groups now. */
  grouped(): boolean;
  /** Open a record as a row's press does, where the app opens records. */
  open?: ((id: RecordId, lit: boolean, name: string) => Promise<void>) | undefined;
}

/** Whether a list's rows each carry an Open button: the page asks for one (`editable.open`), and the app opens records. */
export function opens(node: ListNode, list: Pick<ListContext, 'onOpenRecord'>): boolean {
  return !!list.onOpenRecord && typeof node.editable === 'object' && node.editable.open === true;
}

export interface EditableRows {
  /** Under the table: Add a line, and what a paste did. */
  element: HTMLElement;
  /** Wire a record's row as the list draws it: its cells that can change, and the work kept on it. */
  wire(tr: HTMLTableRowElement, record: Row): void;
  /** A press on a row: true where it changes a cell or opens the row's sheet, rather than opening the record. */
  pressed(tr: HTMLTableRowElement, event: MouseEvent): boolean;
  /** Enter on a row: true where it opens its first cell to change. */
  enter(tr: HTMLTableRowElement): boolean;
  /** A row's Open button, where its rows carry one (`opens`). */
  openButton(record: Row, name: string): HTMLElement[];
  /** Before the list asks again: each row left is saved, and the saves on their way waited for. */
  settle(): Promise<void>;
  /** The rows drawn anew: work kept on a row drawn on it, and kept in sight where its row is not among them. */
  drawn(): void;
  destroy(): void;
}


/** Boxes a person types in, as the viewer reads them before a save. */
const NOT_TYPED = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color', 'hidden']);
const typedBox = (box: Element | null): box is HTMLInputElement | HTMLTextAreaElement => !!box && (box.tagName === 'TEXTAREA' || (box.tagName === 'INPUT' && !NOT_TYPED.has((box as HTMLInputElement).type)));
/** Rows saved at once, where several are left together (a block pasted). */
const SAVES_AT_ONCE = 4;

/** One row being changed: the form it is edited through, the record it is of, its row and the note under it. */
interface RowEdit {
  key: string;
  /** The record as listed, or as its last save left it; null for a row added and not saved yet. */
  record: Row | null;
  form: Form;
  /** Settled once its form has its values. */
  ready: Promise<void>;
  loaded: boolean;
  tr: HTMLTableRowElement | null;
  note: HTMLTableRowElement;
  noteWords: HTMLElement;
  refusal: HTMLElement;
  putBack: HTMLButtonElement;
  safety: ReturnType<typeof saveSafety>;
  editor: Editor | null;
  saving: Promise<boolean> | null;
  /** A save was asked and refused: said under it until it saves or is put back. */
  refused: boolean;
  /** The person is on it: the focus within its row since it was last left. */
  on: boolean;
  gone: boolean;
  stops: (() => void)[];
}

/** A cell open for typing. */
interface Editor {
  td: HTMLTableCellElement;
  column: string;
  widget: Widget;
  box: HTMLElement;
  /** What the cell held, and its text that did not read, as it was opened: what Escape puts back. */
  before: Value | undefined;
  unreadBefore: FormState['unread'][string] | null;
  twisty: Element | null;
  stop: () => void;
}

/**
 * The fields a row's form needs beyond those the list asks for: what its worked-out columns are worked out from, so a
 * total changes as the row's cells do. Asked of the source with the rest.
 */
export function rowReads(page: Page, node: ListNode, reads: readonly string[], functions?: FunctionTable): string[] {
  if (!editableColumns(page, node).length) return [];
  const all = new Set(reads);
  const more: string[] = [];
  for (let i = 0; i < [...all].length; i++) {
    const name = [...all][i];
    const compute = page.fields[name]?.compute;
    if (typeof compute !== 'string') continue;
    let read: readonly string[] = [];
    try {
      read = compileModifier(compute, functions).fields;
    } catch {
      // A formula the page check refuses: nothing more to ask for it.
    }
    for (const field of read) {
      if (!page.fields[field] || all.has(field)) continue;
      all.add(field);
      more.push(field);
    }
  }
  return more;
}

export function editableRows(context: EditableContext): EditableRows | null {
  const { page, model, body, list } = context;
  const { node, doc, el, labels, fill, locale } = list;
  const source = list.dataSource as DataSource;
  const columns = editableColumns(page, node);
  // Nothing to change, nowhere to save it, or no form and box to change it in: the list as it was, its rows read and opened.
  if (!columns.length || !source?.save || !list.newForm || !list.drawField) return null;
  const newForm = list.newForm;
  const drawField = list.drawField;
  const cards = () => context.element.hasAttribute('data-as');
  installEditableStyles(doc);
  const sentence = (noun: string | undefined, words: string) => recordSentence(page.records, noun, words, locale);
  const adds = !(typeof node.editable === 'object' && node.editable.add === false);
  const nodeId = (column: string) => `${node.id}.${column}`;
  const rowFields = [...new Set([...context.reads, ...columns])].filter((name) => page.fields[name]);

  /**
   * The page a row is edited as: the list's fields its form holds, its columns that change in place laid out as fields,
   * the page's own language, clock, phones and words for its records — nothing it would do as a page of its own (its
   * steps, its print, its limits).
   */
  const rowPage: Page = {
    fieldia: page.fieldia,
    id: `${page.id}.${node.id}`,
    ...(page.title ? { title: page.title } : {}),
    data: page.data,
    fields: Object.fromEntries(rowFields.map((name) => [name, page.fields[name]])),
    layout: { type: 'sections', id: `${node.id}-row`, children: columns.map((name) => ({ type: 'field', id: nodeId(name), field: name })) },
    ...(page.look ? { look: page.look } : {}),
    ...(page.language ? { language: page.language } : {}),
    ...(page.translations ? { translations: page.translations } : {}),
    ...(page.phone ? { phone: page.phone } : {}),
    ...(page.timeZone ? { timeZone: page.timeZone } : {}),
    ...(page.records ? { records: page.records } : {}),
    ...(page.lowerLabels !== undefined ? { lowerLabels: page.lowerLabels } : {}),
  };
  const only = (values: Values) => Object.fromEntries(Object.entries(values).filter(([name]) => name in rowPage.fields));

  /** The row's record as the source has it now: a conflict's Reload, Keep mine reading theirs. */
  async function readAgain(id: RecordId): Promise<LoadedRecord> {
    if (source.load) {
      const got = loadedRecordOf(await source.load({ model, id, fields: rowPage.fields }));
      return loadedRecord(only(got.values), { ...(got.version ? { version: got.version } : {}), ...(got.can ? { can: got.can } : {}) });
    }
    const found = source.list ? (await source.list({ model, fields: rowFields, filter: [{ field: 'id', op: '=', value: id }], sort: [], offset: 0, limit: 1 })).records[0] : undefined;
    if (!found) throw new Error(`No ${model} record with id ${id}`);
    return loadedRecord(found.values, { ...(found.version ? { version: found.version } : {}), ...(found.can ? { can: found.can } : {}) });
  }

  /**
   * What a row's form asks of the data source: the record as the list has it first — no second call for what it shows
   * already, its version the one it was listed at — the source's own answer after; a save of the fields the person
   * changed alone (`partial`), as a list never had the whole record. A row added is saved as a new record, whole.
   */
  function rowSource(record: Row | null): DataSource {
    let listed = record;
    const passed: DataSource = {};
    for (const name of ['onchange', 'search', 'create', 'options', 'definitions', 'upload', 'slots'] as const) {
      const member = source[name] as ((...args: unknown[]) => unknown) | undefined;
      if (member) (passed as Record<string, unknown>)[name] = (...args: unknown[]) => member.apply(source, args);
    }
    return {
      ...passed,
      load: async ({ id }) => {
        const first = listed;
        listed = null;
        if (first) return loadedRecord({ ...first.values }, { ...(first.version ? { version: first.version } : {}), ...(first.can ? { can: first.can } : {}) });
        return readAgain(id);
      },
      save: async (request): Promise<SaveResult> => {
        const save = source.save as NonNullable<DataSource['save']>;
        if (request.id === null) {
          const made = await save.call(source, request);
          return made.values ? { ...made, values: only(made.values) } : made;
        }
        const names = new Set([...Object.keys(request.changes.values), ...Object.keys(request.changes.lines), ...Object.keys(request.changes.links)]);
        const pick = <T>(of: Record<string, T>) => Object.fromEntries(Object.entries(of).filter(([name]) => names.has(name)));
        const saved = await save.call(source, { ...request, values: pick(request.values), fields: pick(request.fields), partial: true });
        return saved.values ? { ...saved, values: only(saved.values) } : saved;
      },
    };
  }

  /** A record's row drawn again as the list draws it, in place of this one: its place under a parent kept, its toggle too. */
  function redraw(old: HTMLTableRowElement, record: Row): HTMLTableRowElement {
    const tr = context.row(record, Number(old.getAttribute('data-level') ?? 0));
    for (const name of ['data-depth', 'data-parent-of', 'data-kept']) {
      const value = old.getAttribute(name);
      if (value !== null) tr.setAttribute(name, value);
    }
    const depth = old.style.getPropertyValue('--fd-depth');
    if (depth) tr.style.setProperty('--fd-depth', depth);
    tr.hidden = old.hidden;
    const twisty = old.querySelector(':scope > td[data-name] > :is(.fd-list-twisty, .fd-list-twisty-room)');
    if (twisty) tr.querySelector(':scope > td[data-name]')?.prepend(twisty);
    old.replaceWith(tr);
    return tr;
  }

  /** A row for a record not made yet, as the list draws one: nothing to choose, open or press on it. */
  function blank(key: string, values: Values): HTMLTableRowElement {
    const tr = context.row({ id: key, values });
    tr.setAttribute('data-new', key);
    tr.removeAttribute('data-id');
    tr.querySelector(':scope > .fd-list-check')?.replaceChildren();
    tr.querySelector(':scope > .fd-list-tail')?.replaceChildren();
    return tr;
  }

  // ---- each row's work ------------------------------------------------------------------------------------------

  const edits = new Map<string, RowEdit>();
  /** Each row's record as it was drawn. */
  const rowOf = new WeakMap<HTMLTableRowElement, Row>();
  let added = 0;
  /** Each time the rows are drawn anew: a paste begun before writes on none of them. */
  let drawings = 0;
  let destroyed = false;
  const keyOf = (tr: HTMLTableRowElement) => tr.getAttribute('data-new') ?? tr.getAttribute('data-id') ?? '';
  const nameOf = (values: Readonly<Values>, key: string) => context.cells.words(context.nameColumn, values as Values) || key;
  /** Said to a screen reader as it happens: a row saved. */
  const status = el('span', { class: 'fd-sr-only', role: 'status' });
  const hint = el('span', { class: 'fd-sr-only', id: list.uid(`${node.id}-edit-hint`) }, labels.rowEditHint);

  const lockedOut = (record: Row | null) => record?.can?.edit === false;
  /** Whether a row's cell takes a change now: its column's, its record's permissions and the row's own rules. */
  function changeable(record: Row | null, column: string, form?: Form): boolean {
    if (!columns.includes(column) || lockedOut(record) || record?.can?.readonlyFields?.includes(column) || record?.can?.hiddenFields?.includes(column)) return false;
    if (!form) return true;
    const state = form.node(nodeId(column));
    return !form.fieldReadonly(column) && !state.readonly && !state.invisible;
  }

  /** The values a row added starts with: what the list's fixed conditions name of it (a customer's own list's customer). */
  function startValues(): Values {
    const values: Values = {};
    for (const condition of list.fixedFilter ?? []) {
      if (!('field' in condition)) continue;
      const def = page.fields[condition.field];
      if (condition.op !== '=' || !def || def.type === 'many2one' || def.type === 'many2many' || def.type === 'one2many' || !(condition.field in rowPage.fields)) continue;
      values[condition.field] = condition.value as Value;
    }
    return values;
  }

  /** A row's work: its form, made as it is first needed — from the record as listed, or new — and its note. */
  function start(tr: HTMLTableRowElement, record: Row | null, key: string): RowEdit {
    const form = newForm({ page: rowPage, dataSource: rowSource(record), recordId: record?.id ?? null, ...(record ? {} : { values: startValues() }) });
    const noteWords = el('span', { class: 'fd-list-note-words', id: list.uid(`${node.id}-note-${key}`) });
    const putBack = el('button', { type: 'button', class: 'fd-button fd-button-link fd-list-put-back' }, record ? labels.putBack : labels.rowDrop);
    const refusal = el('div', { class: 'fd-list-refused', role: 'alert', hidden: '' }, noteWords, ' ', putBack);
    const edit: RowEdit = {
      key,
      record,
      form,
      ready: Promise.resolve(),
      loaded: !record,
      tr: null,
      note: el('tr', { class: 'fd-list-note', hidden: '' }),
      noteWords,
      refusal,
      putBack,
      safety: undefined as unknown as RowEdit['safety'],
      editor: null,
      saving: null,
      refused: false,
      on: false,
      gone: false,
      stops: [],
    };
    // Someone else's save first, and the changes Reload set aside: as a record's page says them, under the row.
    edit.safety = saveSafety({
      doc,
      el,
      form,
      page: rowPage,
      labels,
      locale,
      icons: list.icons,
      fill,
      announce: (words) => setText(status, words),
      root: () => edit.tr ?? context.element,
      discard: () => (list.letGo ? list.letGo(sentence(labels.discardChangesNoun, labels.discardChanges)) : Promise.resolve(true)),
    });
    edit.note.append(el('td', { colspan: String(context.span()) }, ...edit.safety.elements, refusal));
    putBack.addEventListener('click', () => putBackRow(edit, true));
    edit.stops.push(form.subscribe(() => paint(edit)));
    // What is typed in its open cell is read before every save and check of its form, as the viewer reads a page's box.
    edit.stops.push(form.settling(() => readOpenBox(edit), () => !!edit.editor && edit.editor.box.contains(doc.activeElement) && typing === doc.activeElement));
    edits.set(key, edit);
    edit.ready = record
      ? form.load().then(() => {
          edit.loaded = true;
        })
      : Promise.resolve();
    attach(edit, tr);
    // Made as the focus came into its row: the person is on it, and leaving it saves it.
    edit.on = tr.contains(doc.activeElement);
    return edit;
  }

  /** The work on a row, made as it is first needed; none for a row its record lets no one change here. */
  function editOf(tr: HTMLTableRowElement): RowEdit | null {
    const key = keyOf(tr);
    const kept = edits.get(key);
    if (kept) {
      if (kept.tr !== tr) attach(kept, tr);
      return kept;
    }
    const record = rowOf.get(tr) ?? null;
    if (!record || tr.hasAttribute('data-new') || lockedOut(record) || !tr.querySelector(':scope > td[data-edit]')) return null;
    return start(tr, record, key);
  }

  /** A row's work on the row drawn for it now: its cells as the person left them, its note under it. */
  function attach(edit: RowEdit, tr: HTMLTableRowElement) {
    if (edit.tr && edit.tr !== tr && edit.editor) closeEditor(edit, false);
    edit.tr = tr;
    placeNote(edit);
    paint(edit);
  }

  /** The note goes right under its row, once the row is in the table. */
  function placeNote(edit: RowEdit) {
    const tr = edit.tr;
    if (!tr?.isConnected) return;
    const cell = edit.note.firstElementChild as HTMLTableCellElement;
    cell.colSpan = context.span();
    if (tr.nextElementSibling !== edit.note) tr.after(edit.note);
  }

  /** A record's cell at rest, drawn from the row's form: the text it could not read, a value that waits, or its value. */
  function paintCell(edit: RowEdit, td: HTMLTableCellElement, column: string, state: FormState) {
    const twisty = td.querySelector(':scope > :is(.fd-list-twisty, .fd-list-twisty-room)');
    const unread = state.unread[column];
    const waits = unread ? null : edit.form.waitsFor(column);
    if (unread) {
      td.replaceChildren(el('span', { class: 'fd-list-unread' }, unread.text), el('span', { class: 'fd-sr-only' }, unread.message));
      setAttr(td, 'title', unread.message);
    } else if (waits) {
      const words = waitWords(edit.form, column, waits);
      td.replaceChildren(el('span', { 'aria-hidden': 'true' }, waits.asking ? '…' : '—'), el('span', { class: 'fd-sr-only' }, words));
      setAttr(td, 'title', words);
    } else {
      td.replaceChildren(...context.cells.draw(column, state.values as Values, nameOf(state.values, edit.key)));
      setAttr(td, 'title', null);
    }
    if (twisty) td.prepend(twisty);
    setAttr(td, 'data-waits', waits ? '' : null);
    setAttr(td, 'aria-invalid', unread || state.errors[column] ? 'true' : null);
    setAttr(td, 'data-changed', state.dirty.includes(column) ? '' : null);
  }

  /** Why a worked-out value waits, as a field's box says it: "Fix Minutes to see Per hour". */
  function waitWords(form: Form, column: string, waits: NonNullable<ReturnType<Form['waitsFor']>>): string {
    const own = page.fields[column]?.label ?? column;
    const at = (template: string, key: string, label: string) => labelAt(template, key, page.lowerLabels, locale)(label);
    if (waits.failed !== undefined) return fill(labels.valueNotWorkedOut, { own: at(labels.valueNotWorkedOut, 'own', own), why: waits.failed });
    if (waits.asking) return fill(labels.valueAsking, { own: at(labels.valueAsking, 'own', own) });
    const field = form.words(page.fields[waits.field]?.label ?? waits.field);
    return fill(labels.valueWaits, { field: at(labels.valueWaits, 'field', field), own: at(labels.valueWaits, 'own', own) });
  }

  /** A field's label inside a sentence of the note, and its problem, said once: "Price must be at least 0". */
  function problemWords(column: string, message: string): string {
    const label = page.fields[column]?.label ?? column;
    return message.includes(label) ? message : `${label}: ${message}`;
  }

  /** A row drawn from its form as it changes: its cells at rest, the note under it, its marks. */
  function paint(edit: RowEdit) {
    if (edit.gone) return;
    const state = edit.form.getState();
    const tr = edit.tr;
    if (tr && edit.loaded) {
      for (const td of tr.querySelectorAll<HTMLTableCellElement>(':scope > td[data-col]')) {
        if (edit.editor?.td === td) continue;
        paintCell(edit, td, td.getAttribute('data-col') ?? '', state);
      }
      setAttr(tr, 'data-changed', state.dirty.length ? '' : null);
      setAttr(tr, 'aria-busy', state.status === 'saving' ? 'true' : null);
    }
    edit.safety.update(state);
    // Refused: why, each problem once — text that does not read, a rule, the source's own words; never while someone
    // else's save waits for the person's choice, which says its own.
    const problems: string[] = [];
    if (edit.refused && !state.conflict) {
      for (const [path, unread] of Object.entries(state.unread)) problems.push(problemWords(path, unread.message));
      for (const [path, message] of Object.entries(state.errors)) if (!state.unread[path]) problems.push(problemWords(path, message));
      if (!problems.length && state.saveProblem && state.saveProblem.kind !== 'conflict') problems.push(state.saveProblem.message);
    }
    // Each problem as said, its own full stop left to the sentence round them.
    const words = problems.length ? fill(labels.rowNotSaved, { why: problems.map((one) => one.replace(/[.。]\s*$/u, '')).join(isRightToLeft(locale) ? '؛ ' : '; ') }) : '';
    setText(edit.noteWords, words);
    setHidden(edit.refusal, !words);
    const says = !!words || !!state.conflict || !!state.setAside;
    setHidden(edit.note, !says);
    if (tr) setAttr(tr, 'aria-describedby', words ? edit.noteWords.id : null);
    // Saved by Keep mine, or nothing left to save once the changes set aside were let go: the row at rest again.
    if (edit.refused && !edit.editor && !state.conflict && !state.setAside && state.status !== 'saving' && !state.dirty.length && !Object.keys(state.unread).length) queueMicrotask(() => edit.refused && settleRow(edit));
  }

  /** Nothing of the person's left on a row that was refused: at rest again, as saved — the focus kept where it was in it. */
  function settleRow(edit: RowEdit) {
    if (edit.gone || edit.editor) return;
    const state = edit.form.getState();
    if (state.dirty.length || state.conflict || state.setAside || Object.keys(state.unread).length) return;
    if (!edit.record && state.recordId === null) return drop(edit);
    done(edit);
  }

  // ---- a cell open for typing ----------------------------------------------------------------------------------

  /** The box typed in since it last read what it holds: a save does not read under the person's keys. */
  let typing: Element | null = null;
  const onTyped = (event: Event) => {
    if (typedBox(event.target as Element)) typing = event.target as Element;
  };
  const onRead = (event: Event) => {
    if (event.target === typing) typing = null;
  };
  context.element.addEventListener('input', onTyped, true);
  context.element.addEventListener('change', onRead, true);
  context.element.addEventListener('focusout', onRead, true);

  /** What is typed in a row's open cell, read as leaving it reads it. */
  function readOpenBox(edit: RowEdit) {
    const active = doc.activeElement;
    if (edit.editor && active && edit.editor.box.contains(active) && typedBox(active)) active.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** The look a column's box takes from its cell: hours as HH:MM, a per cent, a phone, links as tags. */
  function lookOf(column: string): Pick<FieldNode, 'widget' | 'options'> {
    const cell = node.cells?.[column];
    if (!cell?.widget || !CELL_BOXES.has(cell.widget)) return {};
    return { widget: cell.widget, ...(cell.options ? { options: cell.options } : {}) };
  }

  /** Open a cell for typing: its row's form first, then its field's own box in the cell, the focus in it. */
  function editCell(td: HTMLTableCellElement, keyboard = false, pressed = false): void {
    const tr = td.parentElement as HTMLTableRowElement | null;
    if (!tr || destroyed) return;
    const edit = editOf(tr);
    if (!edit) return;
    if (edit.editor?.td === td) return;
    const go = () => {
      open(edit, td, keyboard);
      // A yes or no pressed is answered by the press, as a press on its box would.
      if (pressed && rowPage.fields[td.getAttribute('data-col') ?? '']?.type === 'boolean') edit.editor?.box.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    };
    if (edit.loaded) return go();
    void edit.ready.then(() => {
      if (!edit.gone && td.isConnected && edit.tr === tr) go();
    });
  }

  function open(edit: RowEdit, td: HTMLTableCellElement, keyboard: boolean) {
    const column = td.getAttribute('data-col') ?? '';
    if (!changeable(edit.record, column, edit.form)) return;
    if (edit.editor) closeEditor(edit, false);
    const def = rowPage.fields[column] as Field;
    const id = list.uid(`${node.id}-${edit.key}-${column}`);
    const widget = drawField({
      form: edit.form,
      name: column,
      field: def,
      node: { type: 'field', id: nodeId(column), field: column, ...lookOf(column) },
      id,
      document: doc,
      ...(list.widgetLabels ? { labels: list.widgetLabels } : {}),
      locale,
      preferences: list.preferences,
      ...(list.dialogs ? { dialogs: list.dialogs } : {}),
    });
    // Named by its column's header, for a screen reader: the cell's box has no label of its own in sight.
    const box = el('div', { class: 'fd-list-editor', 'data-type': def.type }, el('label', { class: 'fd-sr-only', for: id }, def.label), widget.element);
    const state = edit.form.getState();
    const twisty = td.querySelector(':scope > :is(.fd-list-twisty, .fd-list-twisty-room)');
    const update = (now: FormState) => {
      const shown = edit.form.node(nodeId(column));
      widget.update({ value: now.values[column], values: now.values, readonly: edit.form.fieldReadonly(column) || shown.readonly, required: shown.required, invalid: !!(now.errors[column] || now.unread[column]), describedBy: `${hint.id} ${edit.noteWords.id}` });
    };
    const editor: Editor = { td, column, widget, box, before: state.values[column], unreadBefore: state.unread[column] ?? null, twisty, stop: edit.form.subscribe(update) };
    edit.editor = editor;
    // As wide as the cell was: the columns stay where they stood while it is open.
    const width = td.getBoundingClientRect().width;
    if (width) td.style.setProperty('width', `${width}px`);
    td.replaceChildren(box);
    td.setAttribute('data-editing', '');
    setAttr(td, 'title', null);
    update(state);
    widget.focus();
    // Reached from the keyboard, its text is chosen, so typing replaces it, as a spreadsheet's cell does.
    const active = doc.activeElement;
    if (keyboard && active instanceof HTMLInputElement && box.contains(active) && typedBox(active)) active.select();
  }

  /**
   * Close a row's open cell: what is typed read as leaving reads it — the box left first, its change and its blur —
   * then the cell at rest. `focusCell`, the focus on the cell after; else it goes where the person put it.
   */
  function closeEditor(edit: RowEdit, focusCell: boolean) {
    const editor = edit.editor;
    if (!editor) return;
    const active = doc.activeElement;
    if (active && editor.box.contains(active)) {
      if (typedBox(active)) active.dispatchEvent(new Event('change', { bubbles: true }));
      if (focusCell) editor.td.focus({ preventScroll: true });
      else (active as HTMLElement).blur();
    } else if (focusCell) editor.td.focus({ preventScroll: true });
    edit.editor = null;
    editor.stop();
    editor.widget.destroy?.();
    editor.td.removeAttribute('data-editing');
    editor.td.style.removeProperty('width');
    editor.td.replaceChildren();
    if (editor.twisty) editor.td.append(editor.twisty);
    if (!edit.gone) {
      edit.form.boxLeft(editor.column);
      paintCell(edit, editor.td, editor.column, edit.form.getState());
    }
  }

  /** Escape in an open cell: the cell holds again what it held as it was opened, its text that did not read too. */
  function putBackCell(edit: RowEdit) {
    const editor = edit.editor;
    if (!editor) return;
    const { column, before, unreadBefore } = editor;
    closeEditor(edit, true);
    const lay = () => {
      if (edit.gone) return;
      edit.form.setValue(column, before === undefined ? null : before);
      edit.form.setUnread(column, unreadBefore);
    };
    // A name being looked up as the box was left lands first; then the cell is put back over it.
    lay();
    if (edit.form.reading()) void edit.form.settle().then(lay);
  }

  /** The cells of a row the person can change, as they stand: in the person's order, those hidden left out. */
  const cellsOf = (tr: HTMLTableRowElement) => [...tr.querySelectorAll<HTMLTableCellElement>(':scope > td[data-edit]:not([hidden])')];
  const rowsShown = () => [...body.querySelectorAll<HTMLTableRowElement>(':scope > tr.fd-list-row:not([hidden])')];

  /** Tab and Shift+Tab: the next cell to change, along the row then on to the next; past the last, a row added. */
  function step(edit: RowEdit, td: HTMLTableCellElement, forward: boolean) {
    const tr = td.parentElement as HTMLTableRowElement;
    const here = cellsOf(tr);
    const beside = here[here.indexOf(td) + (forward ? 1 : -1)];
    if (beside) return editCell(beside, true);
    const rows = rowsShown();
    for (let at = rows.indexOf(tr) + (forward ? 1 : -1); rows[at]; at += forward ? 1 : -1) {
      const cells = cellsOf(rows[at]);
      if (cells.length) return editCell(forward ? cells[0] : cells[cells.length - 1], true);
    }
    if (forward && canAdd()) return void addRow();
    closeEditor(edit, true);
  }

  /** The cell in the same column, a row down or up, past rows that have no such cell. */
  function cellBelow(td: HTMLTableCellElement, down: boolean): HTMLTableCellElement | null {
    const tr = td.parentElement as HTMLTableRowElement;
    const column = td.getAttribute('data-col');
    const rows = rowsShown();
    for (let at = rows.indexOf(tr) + (down ? 1 : -1); rows[at]; at += down ? 1 : -1) {
      const found = rows[at].querySelector<HTMLTableCellElement>(`:scope > td[data-edit][data-col="${column}"]:not([hidden])`);
      if (found) return found;
    }
    return null;
  }

  // ---- keys -----------------------------------------------------------------------------------------------------

  function onKeys(event: KeyboardEvent) {
    if (event.isComposing || event.keyCode === 229) return;
    const tr = event.currentTarget as HTMLTableRowElement;
    const target = event.target as HTMLElement;
    const td = target.closest('td');
    if (td?.hasAttribute('data-editing')) return editorKeys(event, tr, td as HTMLTableCellElement);
    if (target === td && td.hasAttribute('data-edit')) return cellKeys(event, tr, td as HTMLTableCellElement);
    // Escape on the row itself: its changes put back.
    if (target === tr && event.key === 'Escape') {
      const edit = edits.get(keyOf(tr));
      if (edit && hasWork(edit)) {
        event.preventDefault();
        event.stopPropagation();
        putBackRow(edit, true);
      }
    }
  }

  function editorKeys(event: KeyboardEvent, tr: HTMLTableRowElement, td: HTMLTableCellElement) {
    const edit = edits.get(keyOf(tr));
    if (!edit?.editor || event.defaultPrevented) return;
    const mods = event.ctrlKey || event.metaKey || event.altKey;
    if (event.key === 'Tab' && !mods) {
      event.preventDefault();
      step(edit, td, !event.shiftKey);
    } else if (event.key === 'Escape') {
      // Kept from the dialog round the list, which Escape would close.
      event.preventDefault();
      event.stopPropagation();
      putBackCell(edit);
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey) {
      // Ctrl+Enter: this row saved now, the cell kept — never the page's own save.
      event.preventDefault();
      event.stopPropagation();
      closeEditor(edit, true);
      void saveRow(edit);
    } else if (event.key === 'Enter' && !mods && !event.shiftKey && !(event.target instanceof HTMLTextAreaElement)) {
      // Enter: the cell taken, and the same column a row down, as a spreadsheet goes.
      event.preventDefault();
      event.stopPropagation();
      closeEditor(edit, true);
      cellBelow(td, true)?.focus();
    }
  }

  /** Keys typed on a cell at rest before its row's form had its values: typed into its box once it is open. */
  const early = new WeakMap<RowEdit, { td: HTMLTableCellElement; keys: string }>();

  /** A paste's catcher: Ctrl or ⌘ and V on a cell at rest paste there, as no browser sends a paste to a cell. */
  const catcher = el('textarea', { class: 'fd-list-paste-catcher', tabindex: '-1', 'aria-hidden': 'true' }) as HTMLTextAreaElement;
  let catching: HTMLTableCellElement | null = null;

  function cellKeys(event: KeyboardEvent, tr: HTMLTableRowElement, td: HTMLTableCellElement) {
    const mods = event.ctrlKey || event.metaKey || event.altKey;
    const rtl = td.closest('[dir]')?.getAttribute('dir') === 'rtl';
    if ((event.key === 'Enter' || event.key === 'F2') && !mods) {
      event.preventDefault();
      event.stopPropagation();
      editCell(td, true);
    } else if (event.key.toLowerCase() === 'v' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      catching = td;
      catcher.value = '';
      catcher.focus({ preventScroll: true });
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !mods) {
      event.preventDefault();
      cellBelow(td, event.key === 'ArrowDown')?.focus();
    } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !mods) {
      event.preventDefault();
      const cells = cellsOf(tr);
      const forward = (event.key === 'ArrowRight') !== rtl;
      cells[cells.indexOf(td) + (forward ? 1 : -1)]?.focus();
    } else if (event.key === 'Escape') {
      const edit = edits.get(keyOf(tr));
      if (edit && hasWork(edit)) {
        event.preventDefault();
        event.stopPropagation();
        putBackRow(edit, true);
      }
    } else if (event.key.length === 1 && !mods && event.key !== ' ') {
      // A key typed on a cell starts it, that key its first, as a spreadsheet's cell does; keys typed before its form
      // has its values wait for it, in their order.
      const edit = editOf(tr);
      if (!edit) return;
      if (edit.loaded) return editCell(td, true);
      event.preventDefault();
      const waiting = early.get(edit);
      if (waiting) return void (waiting.td === td && (waiting.keys += event.key));
      early.set(edit, { td, keys: event.key });
      void edit.ready.then(() => {
        const typed = early.get(edit);
        early.delete(edit);
        if (!typed || edit.gone || !td.isConnected) return;
        open(edit, td, true);
        const active = doc.activeElement;
        if (edit.editor && active && edit.editor.box.contains(active) && typedBox(active)) doc.execCommand('insertText', false, typed.keys);
      });
    }
  }

  // ---- leaving a row, saving it ---------------------------------------------------------------------------------

  /** Whether a row holds work of the person's: a change, text that does not read, a choice to make. */
  const hasWork = (edit: RowEdit) => {
    const state = edit.form.getState();
    return !edit.record || state.dirty.length > 0 || Object.keys(state.unread).length > 0 || !!state.conflict || !!state.setAside;
  };
  /** Where a row's box takes the person for a moment, which is not leaving it: a dialog it opened, the paste's catcher. */
  const aside = (target: Node | null) => {
    if (target === catcher) return true;
    const dialog = target instanceof Element ? target.closest('dialog, [role="dialog"], [role="alertdialog"], [popover]') : null;
    return !!dialog && !dialog.contains(context.element);
  };
  const within = (edit: RowEdit, target: Node | null) => !!target && (!!edit.tr?.contains(target) || edit.note.contains(target));

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target as Node;
    for (const edit of [...edits.values()]) {
      if (within(edit, target)) edit.on = true;
      else if (edit.on && !aside(target)) leave(edit);
    }
  };
  /** The focus gone to nothing — a press on the page beside the list: the rows the person was on are left. */
  const onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget || ![...edits.values()].some((edit) => edit.on)) return;
    setTimeout(() => {
      const active = doc.activeElement;
      if (destroyed || (active && active !== doc.body) || !doc.hasFocus()) return;
      for (const edit of [...edits.values()]) if (edit.on) leave(edit);
    });
  };
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('focusout', onFocusOut, true);

  /** The person left a row: its open cell read and closed, then the row saved. */
  function leave(edit: RowEdit) {
    edit.on = false;
    closeEditor(edit, false);
    void saveRow(edit);
  }

  /** Save a row, one save at a time: a change made while one is on its way is saved after it. */
  function saveRow(edit: RowEdit): Promise<boolean> {
    const next = (edit.saving ?? Promise.resolve(true)).then(() => saveNow(edit));
    edit.saving = next;
    void next.finally(() => {
      if (edit.saving === next) edit.saving = null;
    });
    return next;
  }

  async function saveNow(edit: RowEdit): Promise<boolean> {
    await edit.ready;
    if (edit.gone) return true;
    const form = edit.form;
    await form.settle();
    if (edit.gone) return true;
    const state = form.getState();
    // Someone else's save waits for the person's choice: Reload or Keep mine, said under the row.
    if (state.conflict || state.setAside) {
      edit.refused = true;
      paint(edit);
      return false;
    }
    if (!state.dirty.length && !Object.keys(state.unread).length) {
      // A row added and left with nothing in it is no record: it goes. Another, nothing to save: at rest.
      if (!edit.record && state.recordId === null) drop(edit);
      // Nothing changed: its form let go, the row as it stands; one refused before and put right, drawn again at rest.
      else if (!edit.editor && edit.refused) done(edit);
      else if (!edit.editor) release(edit);
      return true;
    }
    const ok = await form.save();
    if (edit.gone) return ok;
    edit.refused = !ok;
    // Saved with no cell of it open: at rest, the focus kept where it was in it; else it stays open, the list told.
    if (ok && !edit.editor && !form.getState().dirty.length) done(edit);
    else if (ok) keepSaved(edit);
    else paint(edit);
    return ok;
  }

  /** A row's record as its form holds it now, saved: what the list keeps of it. */
  function savedRecord(edit: RowEdit): Row {
    const state = edit.form.getState();
    const can = state.can ?? edit.record?.can;
    return { id: state.recordId as RecordId, values: { ...(edit.record?.values ?? {}), ...only(state.values as Values) }, ...(state.version ? { version: state.version } : {}), ...(can ? { can } : {}) };
  }

  /** Saved while the person is still on it: the list knows the record as saved, and the row stays open. */
  function keepSaved(edit: RowEdit) {
    const made = !edit.record;
    const record = savedRecord(edit);
    edit.record = record;
    if (made && edit.tr) {
      edit.tr.removeAttribute('data-new');
      edit.tr.setAttribute('data-id', String(record.id));
      edits.delete(edit.key);
      edit.key = String(record.id);
      edits.set(edit.key, edit);
      rowOf.set(edit.tr, record);
    }
    edit.putBack.textContent = labels.putBack;
    context.saved(record, made);
    setText(status, fill(labels.rowSaved, { name: nameOf(record.values, edit.key) }));
    paint(edit);
  }

  /** Saved, and the person elsewhere: the row drawn at rest from the record as saved, its work let go. */
  function done(edit: RowEdit) {
    const made = !edit.record;
    const record = savedRecord(edit);
    atRest(edit, record);
    context.saved(record, made);
    setText(status, fill(labels.rowSaved, { name: nameOf(record.values, String(record.id)) }));
  }

  /** A row's work let go and the row drawn again at rest from its record: where the focus was in it, it stays. */
  function atRest(edit: RowEdit, record: Row) {
    const tr = edit.tr;
    const active = doc.activeElement;
    const focused = tr && active && tr.contains(active) ? ((active as Element).closest('td[data-col]')?.getAttribute('data-col') ?? '') : null;
    release(edit);
    if (!tr?.isConnected) return;
    const fresh = redraw(tr, record);
    if (focused !== null) (fresh.querySelector<HTMLElement>(`:scope > td[data-edit][data-col="${focused}"]`) ?? fresh).focus({ preventScroll: true });
  }

  /** A row's work let go: its form, its note, its open cell. */
  function release(edit: RowEdit) {
    if (edit.gone) return;
    edit.gone = true;
    if (edit.editor) closeEditor(edit, false);
    for (const stop of edit.stops) stop();
    edit.form.dispose();
    edit.note.remove();
    if (edits.get(edit.key) === edit) edits.delete(edit.key);
    if (edit.tr) {
      edit.tr.removeAttribute('data-changed');
      edit.tr.removeAttribute('aria-busy');
      edit.tr.removeAttribute('aria-describedby');
    }
  }

  /** A row added and not saved, taken away: the focus to the row before it, else Add a line. */
  function drop(edit: RowEdit, focus = false) {
    const tr = edit.tr;
    const before = tr?.previousElementSibling;
    release(edit);
    tr?.remove();
    context.changed();
    if (!focus) return;
    const row = before?.closest('tr.fd-list-row') ? (before as HTMLElement) : before?.previousElementSibling instanceof HTMLElement ? before.previousElementSibling : null;
    (row?.classList.contains('fd-list-row') ? row : addButton.hidden ? context.element : addButton).focus();
  }

  /** Put back: the row as the record holds it (as listed, or as last saved), the person's changes let go; a row added, taken away. */
  function putBackRow(edit: RowEdit, focus: boolean) {
    if (!edit.record) return drop(edit, focus);
    const tr = edit.tr;
    const record = edit.record;
    release(edit);
    if (!tr?.isConnected) return;
    const fresh = redraw(tr, record);
    if (focus) fresh.focus({ preventScroll: true });
  }

  // ---- a row added ----------------------------------------------------------------------------------------------

  const canAdd = () => adds && !context.grouped() && !destroyed;
  const addButton = el('button', { type: 'button', class: 'fd-button fd-button-link fd-list-add' }, el('span', { 'aria-hidden': 'true' }, '+'), ' ', sentence(labels.rowAddNoun, labels.rowAdd));
  addButton.addEventListener('click', () => void addRow());

  /** A row added at the end, its first cell open — or, on a phone, its sheet. */
  function addRow(): RowEdit | null {
    if (!canAdd()) return null;
    const key = `new-${++added}`;
    const tr = blank(key, startValues());
    body.append(tr);
    const edit = start(tr, null, key);
    context.changed();
    if (cards()) void sheet(edit);
    else {
      const first = cellsOf(tr)[0];
      if (first) editCell(first, true);
    }
    return edit;
  }

  // ---- on a phone: a card's fields in a sheet ------------------------------------------------------------------

  /** A card's fields in a sheet over the list: what the person changes there is the row's, saved as Done closes it. */
  async function sheet(edit: RowEdit): Promise<void> {
    if (!list.editValues) return;
    await edit.ready;
    if (edit.gone) return;
    const state = edit.form.getState();
    const shown = context.columns().filter((name) => name in rowPage.fields);
    const fields = Object.fromEntries(Object.entries(rowPage.fields).map(([name, def]) => [name, columns.includes(name) && changeable(edit.record, name, edit.form) ? def : { ...def, readonly: true }])) as Record<string, Field>;
    const values = await list.editValues({
      title: edit.record ? fill(labels.rowChange, { name: nameOf(state.values, edit.key) }) : sentence(labels.rowAddNoun, labels.rowAdd),
      fields,
      values: state.values as Values,
      layout: [{ type: 'section', id: `${node.id}-sheet`, columns: 1, children: shown.map((name) => ({ type: 'field', id: `${node.id}-sheet-${name}`, field: name })) }],
      ...(page.lowerLabels ? { lowerLabels: true } : {}),
    });
    if (edit.gone) return;
    if (!values) {
      if (!edit.record && !hasChanges(edit)) drop(edit);
      return;
    }
    for (const name of columns) {
      if (name in values && JSON.stringify(values[name] ?? null) !== JSON.stringify(state.values[name] ?? null)) edit.form.setValue(name, values[name]);
    }
    await saveRow(edit);
  }
  const hasChanges = (edit: RowEdit) => edit.form.getState().dirty.length > 0;

  // ---- a block pasted from a spreadsheet ------------------------------------------------------------------------

  /** What a block pasted did, said politely under the list until the person moves on. */
  const pasteNote = el('p', { class: 'fd-help fd-list-paste-note', role: 'status', hidden: '' });
  catcher.addEventListener('paste', (event) => {
    const td = catching;
    catching = null;
    event.preventDefault();
    event.stopPropagation();
    td?.focus({ preventScroll: true });
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (td && text) void pasteAt(td, text);
  });
  catcher.addEventListener('keyup', () => {
    const td = catching;
    catching = null;
    td?.focus({ preventScroll: true });
  });
  // A block pasted in an open cell spreads from it, as on a cell at rest; one value is the box's, as is a paragraph's
  // lines with no tabs.
  body.addEventListener(
    'paste',
    (event) => {
      const box = event.target as HTMLElement;
      const td = box.closest?.('td[data-editing]') as HTMLTableCellElement | null;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (!td || !text || !text.replace(/\r?\n$/, '').match(/[\t\n]/) || (box instanceof HTMLTextAreaElement && !text.includes('\t'))) return;
      const edit = edits.get(keyOf(td.parentElement as HTMLTableRowElement));
      if (!edit) return;
      event.preventDefault();
      event.stopPropagation();
      putBackCell(edit);
      void pasteAt(td, text);
    },
    true
  );
  body.addEventListener('keydown', (event) => {
    if (!pasteNote.hidden && !(event.ctrlKey || event.metaKey)) pasteNote.hidden = true;
  });

  let pasting: Promise<unknown> = Promise.resolve();
  /** A block pasted on a cell: across the columns shown from it and down the rows, each row then saved. One at a time. */
  function pasteAt(td: HTMLTableCellElement, text: string): Promise<unknown> {
    pasting = pasting.then(() => pasteNow(td, text)).catch(() => undefined);
    return pasting;
  }

  async function pasteNow(td: HTMLTableCellElement, text: string) {
    let part: LinesPart;
    try {
      part = await linesPart.load();
    } catch {
      return;
    }
    const tr = td.parentElement as HTMLTableRowElement;
    const column = td.getAttribute('data-col') ?? '';
    if (!tr.isConnected || destroyed) return;
    const block = part.blockOf(text);
    const at = drawings;
    const from = rowsShown().indexOf(tr);
    if (from < 0) return;
    // The rows it lands on, each with its form ready to take its cells.
    const landing = rowsShown()
      .slice(from, from + block.length)
      .map((row) => editOf(row));
    await Promise.all(landing.map((edit) => edit?.ready));
    if (at !== drawings || destroyed) return;
    const touched = new Set<RowEdit>();
    const rowEdit = (key: string | null) => (key ? edits.get(key) : undefined);
    /** For a name looked up on a row not added yet: a new record's form, made once. */
    let scratch: Form | null = null;
    const blankForm = () => (scratch ??= newForm({ page: rowPage, dataSource: rowSource(null), recordId: null }));
    const valuesOf = (tr: HTMLTableRowElement) => (rowEdit(keyOf(tr))?.form.getState().values as Values | undefined) ?? rowOf.get(tr)?.values ?? {};
    const table: Parameters<LinesPart['pasteRows']>[0] = {
      fields: rowPage.fields as Record<string, LineField>,
      columns: context.columns().filter((name) => name in rowPage.fields),
      lines: () => rowsShown().map((row): Line => ({ key: keyOf(row), values: valuesOf(row) })),
      add: () => addRowQuietly(),
      typable: (line, name) => {
        const row = rowsShown().find((one) => keyOf(one) === line.key);
        const edit = rowEdit(line.key);
        return !!row && !!row.querySelector(`:scope > td[data-edit][data-col="${name}"]`) && changeable(edit?.record ?? rowOf.get(row) ?? null, name, edit?.form);
      },
      reading: (line, name) => ({ locale, ...(lookOf(name).widget ? { widget: lookOf(name).widget } : {}), dateOrder: dateOrderOf({ page }), currency: currencyOf(rowPage.fields[name] as LineField, line.values) }),
      cellName: (line, name) => fill(labels.rowCell, { column: page.fields[name]?.label ?? name, name: nameOf(line.values, line.key) }),
      write: (line, name, value) => {
        const edit = rowEdit(line.key);
        if (!edit) return;
        edit.form.setUnread(name, null);
        edit.form.setValue(name, value);
        touched.add(edit);
      },
      search: (key, name, query, limit, exact) => (rowEdit(key)?.form ?? blankForm()).search(name, query, limit, exact ? { exact: true } : {}),
      choices: async (key, name, values) => {
        const def = rowPage.fields[name];
        const from = def?.type === 'selection' ? optionsList(def.optionsFrom) : undefined;
        if (!from || !source.options) return [];
        return source.options({ list: from.list, values: { ...((rowEdit(key)?.form.getState().values as Values | undefined) ?? {}), ...values } });
      },
      shown: () => !destroyed && at === drawings,
    };
    const said = await part.pasteRows(table, from, column, block, { labels: list.widgetLabels ?? ({} as WidgetLabels), locale });
    (scratch as Form | null)?.dispose();
    if (said === null || destroyed) return;
    pasteNote.textContent = said;
    pasteNote.hidden = !said;
    // Each row pasted on is left at once: saved, rows given the same change in one go where the source can.
    await saveMany([...touched]);
  }

  /** A row added for a pasted row past the last, its form ready, no cell opened: its key, or null where none can be added. */
  function addRowQuietly(): string | null {
    if (!canAdd()) return null;
    const key = `new-${++added}`;
    const tr = blank(key, startValues());
    body.append(tr);
    start(tr, null, key);
    context.changed();
    return key;
  }

  /**
   * Rows left together, saved: those of records the list has, given the same change and checked by their forms, in
   * one `writeMany` where the source has it — each with the version it was listed at — the rest one by one, a few at
   * once. A row `writeMany` refused is saved on its own, so it says why as any row does.
   */
  async function saveMany(rows: RowEdit[]) {
    const alone: RowEdit[] = [];
    const same = new Map<string, RowEdit[]>();
    for (const edit of rows) {
      await edit.form.settle();
      const state = edit.form.getState();
      const changes = edit.form.changes();
      if (!source.writeMany || !edit.record || edit.editor || Object.keys(state.unread).length || state.conflict || Object.keys(changes.lines).length || Object.keys(changes.links).length || !Object.keys(changes.values).length || !edit.form.validate()) {
        alone.push(edit);
        continue;
      }
      const key = JSON.stringify(Object.keys(changes.values).sort().map((name) => [name, changes.values[name]]));
      same.set(key, [...(same.get(key) ?? []), edit]);
    }
    const written: RowEdit[] = [];
    for (const group of same.values()) {
      if (group.length < 2) {
        alone.push(...group);
        continue;
      }
      const values = group[0].form.changes().values;
      const versions: Record<string, RecordVersion> = {};
      for (const edit of group) if (edit.record?.version) versions[String(edit.record.id)] = edit.record.version;
      try {
        const answer = await (source.writeMany as NonNullable<DataSource['writeMany']>).call(source, {
          model,
          ids: group.map((edit) => (edit.record as Row).id),
          values,
          fields: Object.fromEntries(Object.keys(values).map((name) => [name, page.fields[name]])),
          ...(Object.keys(versions).length ? { versions } : {}),
        });
        const refused = new Set(answer.failed.map((one) => String(one.id)));
        for (const edit of group) (refused.has(String((edit.record as Row).id)) ? alone : written).push(edit);
      } catch {
        alone.push(...group);
      }
    }
    for (const edit of written) {
      // Its version now is the source's to tell: asked again below.
      const { version: _, ...record } = savedRecord(edit);
      atRest(edit, record);
      context.saved(record, false);
    }
    let next = 0;
    const one = async () => {
      while (next < alone.length) await saveRow(alone[next++]);
    };
    await Promise.all(Array.from({ length: Math.min(SAVES_AT_ONCE, alone.length) }, one));
    // Their versions as the source has them now, for the next change of each — the focus back on the cell it was on.
    if (!written.length || destroyed) return;
    const active = doc.activeElement;
    const at = active?.closest?.('tr.fd-list-row[data-id] > td[data-col]');
    const back = at ? [at.parentElement?.getAttribute('data-id'), at.getAttribute('data-col')] : null;
    await context.reload();
    if (back && (doc.activeElement === doc.body || !doc.activeElement)) body.querySelector<HTMLElement>(`:scope > tr.fd-list-row[data-id="${back[0]}"] > td[data-col="${back[1]}"]`)?.focus({ preventScroll: true });
  }

  // ---- the list's own ---------------------------------------------------------------------------------------------

  const element = el('div', { class: 'fd-list-adds' }, ...(adds ? [addButton] : []), pasteNote, hint, status, catcher);

  return {
    element,
    wire(tr, record) {
      rowOf.set(tr, record);
      for (const td of tr.querySelectorAll<HTMLTableCellElement>(':scope > td[data-col]')) {
        const column = td.getAttribute('data-col') ?? '';
        if (!changeable(record, column)) continue;
        td.setAttribute('data-edit', '');
        td.tabIndex = -1;
        td.setAttribute('aria-describedby', hint.id);
      }
      tr.addEventListener('keydown', onKeys);
      // The row's form made as a cell of it is reached, so a key typed there opens the cell at once.
      tr.addEventListener('focusin', (event) => {
        if ((event.target as Element).matches?.('td[data-edit]')) editOf(tr);
      });
      const kept = edits.get(String(record.id));
      if (kept && !kept.gone) attach(kept, tr);
    },
    pressed(tr, event) {
      const target = event.target as Element;
      const td = target.closest('td');
      // A press inside an open box is the box's.
      if (td?.hasAttribute('data-editing') || target.closest('.fd-list-note')) return true;
      if (cards()) {
        if (!list.editValues || target.closest('button, a, input, label')) return false;
        const edit = editOf(tr);
        if (!edit) return false;
        void sheet(edit);
        return true;
      }
      if (!td?.hasAttribute('data-edit')) return false;
      editCell(td as HTMLTableCellElement, false, true);
      return true;
    },
    enter(tr) {
      if (cards()) {
        const edit = list.editValues ? editOf(tr) : null;
        if (edit) void sheet(edit);
        return !!edit;
      }
      const first = cellsOf(tr)[0];
      if (!first) return false;
      editCell(first, true);
      return true;
    },
    openButton(record, name) {
      const open = context.open;
      if (!open || !opens(node, list)) return [];
      const button = el('button', { type: 'button', class: 'fd-button fd-button-link fd-list-open', 'aria-label': fill(labels.rowOpen, { name }), title: fill(labels.rowOpen, { name }) }, el('span', { 'aria-hidden': 'true' }, '↗'));
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        void open(record.id, true, name);
      });
      return [button];
    },
    async settle() {
      // A row the person is on, its cell open, is left as the list moves on: read, closed, saved.
      for (const edit of [...edits.values()]) if (edit.on || edit.editor) leave(edit);
      await Promise.all([...edits.values()].map((edit) => edit.saving));
    },
    drawn() {
      drawings++;
      // Under Group By headings no row is added: the end of which group would it be?
      addButton.hidden = !canAdd();
      for (const edit of [...edits.values()]) {
        if (edit.gone) continue;
        if (edit.tr?.isConnected) {
          placeNote(edit);
          continue;
        }
        // Not among the rows the list shows now: the person's work stays in sight, at the end, until it is saved or put back.
        if (!hasWork(edit)) {
          release(edit);
          continue;
        }
        const tr = edit.record ? redraw(el('tr'), edit.record) : blank(edit.key, edit.form.getState().values as Values);
        tr.setAttribute('data-kept', '');
        body.append(tr);
        attach(edit, tr);
      }
      context.changed();
    },
    destroy() {
      destroyed = true;
      doc.removeEventListener('focusin', onFocusIn, true);
      doc.removeEventListener('focusout', onFocusOut, true);
      context.element.removeEventListener('input', onTyped, true);
      context.element.removeEventListener('change', onRead, true);
      context.element.removeEventListener('focusout', onRead, true);
      // What the person changed and left valid is saved still; then every row's form goes.
      const going = [...edits.values()].map((edit) => {
        closeEditor(edit, false);
        return (hasWork(edit) && edit.record ? edit.form.save().catch(() => false) : Promise.resolve(true)).finally(() => release(edit));
      });
      void Promise.all(going);
    },
  };
}
