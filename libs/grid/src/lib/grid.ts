import {
  _stopPropagationForAgGrid,
  AllCommunityModule,
  createGrid,
  themeQuartz,
  type ColDef,
  type ColumnState,
  type GridApi,
  type ICellEditorComp,
  type ICellEditorParams,
  type ICellRendererComp,
  type ICellRendererParams,
  type IHeaderComp,
  type IHeaderParams,
  type SuppressKeyboardEventParams,
} from 'ag-grid-community';
import { fill, lineKind, type Field, type Locale, type FieldNode, type Form, type Line, type LineField, type LineKinds, type Value, type Values } from '@fieldia/core';
import { installGridStyles } from './styles';
import { createWidget, displayValue, kindTextField, lineForm, WIDGET_LABELS, type WidgetDialogs, type Widget, type WidgetContext, type WidgetFactory, type WidgetLabels } from '@fieldia/widgets';

/**
 * A one2many as a spreadsheet, on AG Grid. Each cell is edited with the same
 * Fieldia widget the plain table uses, wired to its line, so every keystroke
 * reaches the form at once. AG Grid never changes the data itself
 * (`readOnlyEdit`); its rows follow the form.
 *
 * A page asks for it with `"widget": "grid"` on a one2many node, and an app
 * turns it on by passing `gridWidgets` to the viewer. Without it the page shows
 * the plain table, so simple forms never load AG Grid.
 */

const apis = new WeakMap<HTMLElement, GridApi<Line>>();

/** The AG Grid API behind a grid's element, for an app that needs more than the page describes. */
export function gridApiOf(element: HTMLElement): GridApi<Line> | undefined {
  return apis.get(element);
}

/** Everything a cell needs, handed to AG Grid's editors and renderers. */
interface CellContext {
  form: Form;
  field: string;
  fieldId: string;
  defs: Record<string, LineField>;
  labels: WidgetLabels;
  registry?: Record<string, WidgetFactory>;
  /** Escape was pressed while editing this line: put it back as it was when the edit began. */
  cancel(key: string, before: Values): void;
  /** An editor of this line closed. With a whole line open, several close at once. */
  finish(key: string): void;
  /** How the lines tell sections and notes from items, when they do. */
  kinds?: LineKinds;
  /** What a line is: a section, a note, or (null) an item. */
  kindOf(line: Line | undefined): 'section' | 'note' | null;
  /** A whole line is edited at once: AG Grid then takes no popup editors. */
  rowMode: boolean;
  /** The grid's own box, which nothing clips: where a link's list floats while its line is open. */
  layer: HTMLElement;
  /** The page's language, for the numbers and dates typed in a cell. */
  locale?: Locale;
  /** Dialogs a cell's link may open: Search more…, Create and edit…. */
  dialogs?: WidgetDialogs;
}

/** The grid's own columns (the drag handle, the delete button) start with two underscores. */
const isTool = (id: string) => id.startsWith('__');
/** The column a section or note spans from: the first field shown. */
const spanStart = (api: GridApi<Line>) => api.getAllDisplayedColumns().find((c) => !isTool(c.getColId()));
/** How many columns a section or note covers: every field shown. */
const spanWidth = (api: GridApi<Line>) => api.getAllDisplayedColumns().filter((c) => !isTool(c.getColId())).length;

type LineDef = Extract<Field, { type: 'one2many' }>;

// ---- cells ------------------------------------------------------------------------

/** Yes or no, ticked in place: no editor to open for one click. */
class CheckboxRenderer implements ICellRendererComp<Line> {
  private box!: HTMLInputElement;
  private params!: ICellRendererParams<Line> & { cell: CellContext; subfield: string };
  init(params: ICellRendererParams<Line> & { cell: CellContext; subfield: string }) {
    this.params = params;
    this.box = document.createElement('input');
    this.box.type = 'checkbox';
    this.box.className = 'fd-checkbox';
    this.box.setAttribute('aria-label', params.cell.defs[params.subfield].label);
    this.box.addEventListener('change', () => {
      const { cell, subfield, data } = this.params;
      if (data) cell.form.updateLine(cell.field, data.key, subfield, this.box.checked);
    });
    this.refresh(params);
  }
  getGui() {
    return this.box;
  }
  refresh(params: ICellRendererParams<Line> & { cell: CellContext; subfield: string }) {
    this.params = params;
    this.box.checked = params.data?.values[params.subfield] === true;
    this.box.disabled = params.cell.form.fieldReadonly(params.cell.field);
    return true;
  }
}

/** The button that opens a line in a dialog, with every one of its fields. */
class OpenRenderer implements ICellRendererComp<Line> {
  private button!: HTMLButtonElement;
  init(params: ICellRendererParams<Line> & { open: (line: Line) => void; label: string }) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'fd-line-open';
    this.button.textContent = '↗';
    this.button.setAttribute('aria-label', params.label);
    this.button.addEventListener('click', () => params.data && params.open(params.data));
  }
  getGui() {
    return this.button;
  }
  refresh() {
    return true;
  }
}

/** The delete button at the end of each line. */
class DeleteRenderer implements ICellRendererComp<Line> {
  private button!: HTMLButtonElement;
  init(params: ICellRendererParams<Line> & { cell: CellContext }) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'fd-line-delete';
    this.button.textContent = '×';
    this.button.setAttribute('aria-label', params.cell.labels.deleteLine);
    this.button.addEventListener('click', () => {
      if (params.data) params.cell.form.removeLine(params.cell.field, params.data.key);
    });
  }
  getGui() {
    return this.button;
  }
  refresh() {
    return true;
  }
}

/** What the column chooser's header button needs from its grid. */
interface Chooser {
  label: string;
  toggle(button: HTMLButtonElement, fromKeyboard: boolean): void;
}

/** The header of the last column: a button that opens the column chooser. */
class ChooserHeader implements IHeaderComp {
  private button!: HTMLButtonElement;
  init(params: IHeaderParams & { chooser: Chooser }) {
    const button = (this.button = document.createElement('button'));
    button.type = 'button';
    button.className = 'fd-grid-chooser-button';
    button.textContent = '⋮';
    button.tabIndex = -1; // AG Grid moves the focus between header cells itself
    button.setAttribute('aria-label', params.chooser.label);
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => params.chooser.toggle(button, false));
    // From the keyboard the header cell has the focus, not the button.
    params.eGridHeader.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      params.chooser.toggle(button, true);
    });
  }
  getGui() {
    return this.button;
  }
  refresh() {
    return true;
  }
}

/** A cell being edited: the field's own Fieldia widget, writing straight into its line. */
class FieldiaCellEditor implements ICellEditorComp<Line> {
  private box!: HTMLElement;
  private widget!: Widget;
  private leave = () => undefined as void;
  private params!: ICellEditorParams<Line> & { cell: CellContext; subfield: string };
  /** The line as it was when the edit began, for Escape to put back. */
  private before: Values = {};
  /** The line field this editor writes: the column's, or a section's or note's text. */
  private column = '';
  private def!: LineField;
  private note: HTMLTextAreaElement | null = null;
  private floating: { list: HTMLElement; watch: MutationObserver } | null = null;

  init(params: ICellEditorParams<Line> & { cell: CellContext; subfield: string }) {
    this.params = params;
    // Not `column`: AG Grid's own params carry the column object under that name.
    const { cell } = params;
    const key = params.data.key;
    const kind = cell.kindOf(params.data);
    const column = (this.column = kind && cell.kinds ? cell.kinds.text : params.subfield);
    const def = (this.def = kind ? kindTextField(cell.defs[column], kind) : cell.defs[column]);
    const node: FieldNode = { type: 'field', id: `${cell.fieldId}.${key}.${column}`, field: column };
    const context: WidgetContext = {
      form: lineForm(cell.form, cell.field, key),
      name: column,
      field: def as Field,
      node,
      id: `${cell.fieldId}-${key}-${column}-editor`,
      document,
      labels: cell.labels,
      locale: cell.locale,
      dialogs: cell.dialogs,
    };
    this.widget = createWidget(context, cell.registry);
    this.box = document.createElement('div');
    this.box.className = 'fd-grid-editor';
    this.box.dataset['type'] = def.type;
    if (kind) this.box.dataset['kind'] = kind;
    this.box.setAttribute('aria-label', def.label);
    this.box.append(this.widget.element);
    if (kind === 'note') this.growing(this.box.querySelector('textarea'));
    if (cell.rowMode) this.floatList();
    if (this.isPopup()) {
      // AG Grid places a popup over its cell but leaves its size to the editor.
      const { width, height } = params.eGridCell.getBoundingClientRect();
      Object.assign(this.box.style, { width: `${width}px`, height: `${height}px` });
    }
    // The form never changes values in place, so holding them is enough.
    this.before = this.line()?.values ?? {};
    // A key the widget used itself (Enter picking from its list, Escape closing it) is not the grid's.
    this.box.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) _stopPropagationForAgGrid(event);
      else if (event.key === 'Escape') params.cell.cancel(key, this.before);
    });
    // Like a spreadsheet, a cell reached from the keyboard has its text selected,
    // so typing replaces it; a click still puts the caret where it lands.
    let pointing = false;
    this.box.addEventListener('pointerdown', () => (pointing = true));
    this.box.addEventListener('focusin', (event) => {
      const input = event.target;
      if (!pointing && input instanceof HTMLInputElement && input.type !== 'checkbox' && input.type !== 'radio') input.select();
      pointing = false;
    });
    const show = () => {
      const line = this.line();
      // A cell the form found wrong stays marked while it is fixed.
      const invalid = !!cell.form.getState().errors[`${cell.field}.${key}.${column}`];
      this.box.classList.toggle('fd-grid-editor-invalid', invalid);
      this.widget.update({ value: line?.values[column], values: line?.values ?? {}, readonly: false, required: def.required === true, invalid });
    };
    show();
    this.leave = cell.form.subscribe(show);
  }
  /**
   * A note is typed in a box that starts one line tall and grows with its text,
   * taking its row (and the rows below) with it: the lessons of the bench.
   */
  private growing(area: HTMLTextAreaElement | null) {
    if (!area) return;
    this.note = area;
    area.rows = 1; // a textarea is two lines tall by default, which made a one-line note jump
    area.addEventListener('input', () => {
      this.resize();
      requestAnimationFrame(() => this.keepBottomInView());
    });
    // Enter makes a new line; Ctrl/Cmd+Enter finishes the note.
    area.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      _stopPropagationForAgGrid(event);
      this.params.api.stopEditing();
    });
  }
  /**
   * In a cell, a link's list would be cut off by the rows around it, so it
   * floats in the grid's own box, under its input, while the line is open.
   */
  private floatList() {
    const list = this.box.querySelector<HTMLElement>('.fd-listbox');
    if (!list) return;
    const { layer, document: doc } = { layer: this.params.cell.layer, document: this.box.ownerDocument };
    list.classList.add('fd-grid-floating-list');
    layer.append(list);
    const place = () => {
      if (list.hidden || !this.box.isConnected) return;
      const at = (this.box.querySelector('input') ?? this.box).getBoundingClientRect();
      const frame = layer.getBoundingClientRect();
      const rtl = doc.defaultView?.getComputedStyle(layer).direction === 'rtl';
      list.style.insetBlockStart = `${at.bottom - frame.top + 2}px`;
      list.style.insetInlineStart = `${rtl ? frame.right - at.right : at.left - frame.left}px`;
      list.style.minWidth = `${this.params.eGridCell.getBoundingClientRect().width}px`;
    };
    const watch = new MutationObserver(place);
    watch.observe(list, { attributes: true, attributeFilter: ['hidden'], childList: true });
    this.floating = { list, watch };
    place();
  }
  private resize() {
    const area = this.note;
    if (!area) return;
    const { node, api } = this.params;
    area.style.height = 'auto';
    const content = area.scrollHeight;
    area.style.height = `${content}px`;
    const height = Math.max(40, content + 2);
    if (height === node.rowHeight) return;
    node.setRowHeight(height);
    api.onRowHeightChanged();
  }
  /** While typing on a note's last line, keep its bottom edge in view, not just the caret. */
  private keepBottomInView() {
    const area = this.note;
    if (!area?.isConnected || area.value.indexOf('\n', area.selectionEnd) !== -1) return;
    const hidden = area.getBoundingClientRect().bottom + 4 - window.innerHeight;
    if (hidden > 0) window.scrollBy(0, hidden);
  }
  private line(): Line | undefined {
    const lines = (this.params.cell.form.getState().values[this.params.cell.field] as Line[] | null) ?? [];
    return lines.find((l) => l.key === this.params.data.key);
  }
  getGui() {
    return this.box;
  }
  afterGuiAttached() {
    // With a whole line open, every editor is attached: only the one clicked takes the focus.
    if (this.params.cellStartedEdit === false) return;
    this.widget.focus();
    if (this.note) {
      this.note.setSelectionRange(this.note.value.length, this.note.value.length);
      this.resize();
      return;
    }
    const input = this.box.querySelector('input');
    if (input && input.type !== 'checkbox' && document.activeElement === input) input.select();
  }
  getValue() {
    return this.line()?.values[this.column];
  }
  /** Lists that open below their input need room the cell does not have (a whole open line floats them instead). */
  isPopup() {
    if (this.params.cell.rowMode) return false;
    const type = this.def.type;
    return type === 'many2one' || type === 'many2many' || type === 'reference';
  }
  getPopupPosition(): 'over' {
    return 'over';
  }
  destroy() {
    this.leave();
    this.floating?.watch.disconnect();
    this.floating?.list.remove();
    this.widget.destroy?.();
    const { node, api, cell, data } = this.params;
    cell.finish(data.key);
    // A note's row grew by hand while it was typed; drawing it afresh measures
    // it again from its text (resetting the height would make it one line tall).
    if (this.note) {
      setTimeout(() => {
        if (!api.isDestroyed() && node.rowIndex !== null) api.redrawRows({ rowNodes: [node] });
      });
    }
  }
}

// ---- the widget -------------------------------------------------------------------

/** Past this many lines a table stops growing and scrolls inside, drawing only the rows in view. */
const LONG_TABLE = 15;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 38;

const EDITABLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'date', 'datetime', 'selection', 'many2one', 'many2many', 'reference']);

export const gridWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, preferences, locale, dialogs }) => {
  const def = field as LineDef;
  const kinds = def.lineKinds;
  const sequence = def.sequenceField;
  // The fields that say what a line is and keep the lines' order never show as columns.
  const columns = (node.columns ?? Object.keys(def.fields)).filter((column) => def.fields[column] && column !== kinds?.field && column !== sequence);
  const kindOf = (line: Line | undefined) => (line ? lineKind(def, line.values) : null);
  // Columns a person may hide or show, and where their choices (and widths, and order) are kept.
  const optional = node.optionalColumns ?? {};
  const optionalIds = columns.filter((column) => column in optional);
  const columnsKey = `${form.page.id}.${node.id}.columns`;
  // Number columns the page asks to add up, in a row pinned under the lines.
  const totals = (node.totals ?? []).filter((column) => columns.includes(column));
  const totalsRow = (current: Line[]): Line => {
    const items = current.filter((line) => !kindOf(line));
    const values = Object.fromEntries(totals.map((c) => [c, items.reduce((sum, line) => sum + Number(line.values[c] ?? 0), 0)]));
    return { key: '__totals', values: { ...(items[0]?.values ?? {}), ...values } };
  };
  const element = document.createElement('div');
  const cell: CellContext = {
    form,
    field: name,
    fieldId: node.id,
    defs: def.fields,
    labels,
    cancel: () => undefined,
    finish: () => undefined,
    kinds,
    kindOf,
    rowMode: node.editMode === 'row',
    layer: element,
    locale,
    dialogs,
  };
  installGridStyles(document);

  element.className = 'fd-grid-lines';
  element.id = id;
  element.setAttribute('role', 'group');
  const host = document.createElement('div');
  host.className = 'fd-grid-host';
  // What is wrong on which line, once a save has been refused.
  const problems = document.createElement('div');
  problems.className = 'fd-error fd-grid-problems';
  problems.setAttribute('role', 'alert');
  problems.hidden = true;
  const adds = document.createElement('div');
  adds.className = 'fd-lines-adds';
  element.append(host, problems, adds);

  let readonly = false;
  const lines = () => (form.getState().values[name] as Line[] | null) ?? [];
  const firstEditable = () => columns.find((c) => EDITABLE.has(def.fields[c].type) && !def.fields[c].readonly);
  /** The line field a cell edits: its column's, or a section's or note's text. */
  const editedField = (line: Line, column: string) => (kindOf(line) && kinds ? kinds.text : column);
  /** The message for a cell, if the form found its value wrong. */
  const problemAt = (line: Line | undefined, column: string, api: GridApi<Line>) => {
    if (!line || (kindOf(line) && spanStart(api)?.getColId() !== column)) return undefined;
    return form.getState().errors[`${name}.${line.key}.${editedField(line, column)}`];
  };
  /** Every line problem, in the order the lines and columns are shown. */
  const lineProblems = () => {
    const shown = api.getAllDisplayedColumns().map((c) => c.getColId()).filter((id) => !isTool(id));
    const found: { index: number; column: string; message: string }[] = [];
    lines().forEach((line, index) => {
      for (const column of shown) {
        const message = problemAt(line, column, api);
        if (message) found.push({ index, column, message });
      }
    });
    return found;
  };
  /** Lines the grid added that nobody has finished an edit in yet: Escape takes them away again. */
  const fresh = new Set<string>();
  /** Lines Escape was pressed in, with how they were: the first of their editors to close acts on it. */
  const cancelling = new Map<string, Values>();
  // Every editor of an open line took the same picture of it, so any one will do.
  cell.cancel = (key, before) => void cancelling.set(key, before);
  cell.finish = (key) => {
    const before = cancelling.get(key);
    if (!before) return void fresh.delete(key);
    cancelling.delete(key);
    if (fresh.delete(key)) return form.removeLine(name, key);
    const current = lines();
    if (current.some((l) => l.key === key)) form.setValue(name, current.map((l) => (l.key === key ? { ...l, values: before } : l)));
  };
  /** Add a line (or a section or note) at the end and start editing its first cell. */
  const addAndEdit = (values: Values = {}) => {
    const key = form.addLine(name, values);
    fresh.add(key);
    const index = lines().findIndex((l) => l.key === key);
    const column = kindOf(lines()[index]) ? spanStart(api)?.getColId() : firstEditable();
    if (index < 0 || !column) return;
    api.ensureIndexVisible(index);
    api.setFocusedCell(index, column);
    api.startEditingCell({ rowIndex: index, colKey: column });
  };
  /**
   * Keys the grid must leave alone, and the two that run off the end of the
   * table while editing: Enter on the last line and Tab on its last editable
   * cell both start a new line.
   */
  const keys = ({ event, editing, node, column }: SuppressKeyboardEventParams<Line>) => {
    if (event.defaultPrevented) return true;
    // Alt+Up/Down moves the line (below), it does not move the focus.
    if (!editing && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return true;
    // In a note, Enter is a new line of the note (Ctrl/Cmd+Enter finishes it).
    if (editing && event.key === 'Enter' && !event.ctrlKey && !event.metaKey && kindOf(node.data) === 'note') return true;
    if (!editing || event.type !== 'keydown' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (node.rowIndex !== lines().length - 1) return false;
    const shown = api.getAllDisplayedColumns();
    const lastCell = !shown.slice(shown.indexOf(column) + 1).some((c) => c.isCellEditable(node));
    if (event.key === 'Enter' || (event.key === 'Tab' && lastCell)) {
      event.preventDefault();
      api.stopEditing();
      addAndEdit();
      return true;
    }
    return false;
  };

  const columnDefs: ColDef<Line>[] = columns.map((column) => {
    const sub = def.fields[column];
    const numeric = sub.type === 'integer' || sub.type === 'float' || sub.type === 'monetary';
    // Words get the room; numbers and yes/no take what they need.
    const wide = ['char', 'text', 'html', 'many2one', 'many2many', 'reference', 'selection'].includes(sub.type);
    /** Whether this column is where a section's or note's text starts. */
    const spans = (api: GridApi<Line>) => spanStart(api)?.getColId() === column;
    const base: ColDef<Line> = {
      colId: column,
      headerName: sub.label,
      valueGetter: (p) => {
        if (p.node?.rowPinned) {
          if (totals.includes(column)) return p.data?.values[column];
          return spans(p.api) ? labels.total : null;
        }
        if (!kindOf(p.data)) return p.data?.values[column];
        return kinds && spans(p.api) ? p.data?.values[kinds.text] : null;
      },
      valueFormatter: (p) =>
        kindOf(p.data) || (p.node?.rowPinned && !totals.includes(column)) ? String(p.value ?? '') : displayValue(sub, p.value as Value, p.data?.values ?? {}, locale),
      type: numeric ? 'rightAligned' : undefined,
      // A section or note runs across every column but the delete button.
      colSpan: (p) => (kindOf(p.data) && spans(p.api) ? spanWidth(p.api) : 1),
      // Rows are measured, so a note of several lines shows all of them.
      autoHeight: !!kinds,
      cellClassRules: {
        'fd-grid-kind-text': (p) => !!kindOf(p.data),
        'fd-grid-invalid': (p) => !p.node.rowPinned && !!problemAt(p.data, column, p.api),
      },
      tooltipValueGetter: (p) => (p.node?.rowPinned ? undefined : problemAt(p.data, column, p.api)),
      suppressKeyboardEvent: keys,
      // Money keeps room for a bold total in the millions (EGP 1,234,567.00).
      minWidth: wide ? 140 : sub.type === 'monetary' ? 150 : 96,
      flex: wide ? 2 : sub.type === 'monetary' ? 1.3 : 1,
      hide: optional[column] === 'hide',
      editable: (p) => {
        if (readonly || p.node.rowPinned) return false;
        if (kindOf(p.data)) return spans(p.api);
        return sub.type !== 'boolean' && EDITABLE.has(sub.type) && !sub.readonly;
      },
      cellEditor: FieldiaCellEditor,
      cellEditorParams: { cell, subfield: column },
    };
    if (sub.type === 'boolean') {
      return {
        ...base,
        cellRendererSelector: (p) => (kindOf(p.data) || p.node.rowPinned ? undefined : { component: CheckboxRenderer, params: { cell, subfield: column } }),
        flex: 0,
        width: 100,
        minWidth: 80,
      };
    }
    return base;
  });
  if (sequence) {
    // Lines that keep an order are moved by a handle at their start.
    columnDefs.unshift({
      colId: '__handle',
      headerName: '',
      rowDrag: (p) => !p.node.rowPinned,
      width: 32,
      minWidth: 32,
      maxWidth: 32,
      cellClass: 'fd-grid-tools fd-grid-handle',
      resizable: false,
      sortable: false,
      suppressMovable: true,
      lockPosition: 'left',
      suppressKeyboardEvent: keys,
    });
  }
  // AG Grid copies column definitions deeply, so the button calls through, never a copy.
  // With dialogs, a line can be opened to see and edit every one of its fields at once.
  const openLine = async (line: Line) => {
    if (!dialogs) return;
    const fields = Object.fromEntries(Object.entries(def.fields).filter(([key]) => key !== kinds?.field && key !== sequence)) as Record<string, Field>;
    const values = await dialogs.editValues({ title: def.label, fields, values: line.values, readonly });
    if (!values) return;
    // Written in one go, so the form recalculates once.
    form.setValue(name, lines().map((l) => (l.key === line.key ? { ...l, values: { ...l.values, ...values } } : l)));
  };
  if (dialogs) {
    columnDefs.push({
      colId: '__open',
      headerName: '',
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      cellClass: 'fd-grid-tools',
      resizable: false,
      sortable: false,
      suppressMovable: true,
      lockPosition: 'right',
      cellRendererSelector: (p) => (p.node.rowPinned || kindOf(p.data) ? undefined : { component: OpenRenderer, params: { open: openLine, label: labels.openLine } }),
      suppressKeyboardEvent: keys,
    });
  }
  const chooser: Chooser = { label: labels.chooseColumns, toggle: (button, fromKeyboard) => toggleChooser(button, fromKeyboard) };
  columnDefs.push({
    colId: '__delete',
    headerName: '',
    lockPosition: 'right',
    ...(optionalIds.length ? { headerComponent: ChooserHeader, headerComponentParams: { chooser } } : {}),
    width: 44,
    minWidth: 44,
    maxWidth: 44,
    cellClass: 'fd-grid-tools',
    resizable: false,
    sortable: false,
    suppressMovable: true,
    cellRendererSelector: (p) => (p.node.rowPinned ? undefined : { component: DeleteRenderer, params: { cell } }),
    suppressKeyboardEvent: keys,
  });

  const api: GridApi<Line> = createGrid<Line>(
    host,
    {
      theme: themeQuartz.withParams({
        fontFamily: 'var(--fd-font)',
        fontSize: 13.5,
        foregroundColor: 'var(--fd-text)',
        backgroundColor: 'var(--fd-surface)',
        headerTextColor: 'var(--fd-muted)',
        headerBackgroundColor: 'var(--fd-surface)',
        borderColor: 'var(--fd-border)',
        accentColor: 'var(--fd-accent)',
        wrapperBorderRadius: 'var(--fd-radius)',
        rowHeight: ROW_HEIGHT,
        headerHeight: HEADER_HEIGHT,
      }),
      columnDefs,
      rowData: lines(),
      pinnedBottomRowData: totals.length ? [totalsRow(lines())] : undefined,
      getRowId: (p) => p.data.key,
      getRowClass: (p) => {
        if (p.node.rowPinned) return 'fd-grid-totals';
        const kind = kindOf(p.data);
        return kind ? `fd-grid-${kind}` : undefined;
      },
      domLayout: 'autoHeight',
      // Lines have few columns: all of them are drawn.
      suppressColumnVirtualisation: true,
      readOnlyEdit: true,
      // An empty table shows its Add a line button below, not a message inside.
      suppressNoRowsOverlay: true,
      singleClickEdit: true,
      // A page may ask for a whole line to open at once.
      editType: node.editMode === 'row' ? 'fullRow' : undefined,
      stopEditingWhenCellsLoseFocus: true,
      // Like a spreadsheet: Enter keeps what was typed and moves down.
      enterNavigatesVerticallyAfterEdit: true,
      // A line dragged by its handle moves among the others as it goes; where
      // it is let go, the form moves it too and numbers the lines again.
      rowDragManaged: !!sequence,
      rowDragText: (p) => {
        const line = p.rowNode?.data;
        const text = line && (kindOf(line) && kinds ? line.values[kinds.text] : line.values[columns[0]]);
        return text && typeof text === 'object' ? String((text as { label?: string }).label ?? '') : String(text ?? '');
      },
      onRowDragEnd: (event) => {
        const key = event.node.data?.key;
        if (key && event.node.rowIndex !== null) form.moveLine(name, key, event.node.rowIndex);
      },
      animateRows: false,
      suppressMovableColumns: false,
      defaultColDef: { sortable: false, resizable: true },
    },
    { modules: [AllCommunityModule] }
  );
  apis.set(element, api);

  // ---- columns a person arranged: kept, and brought back ----
  // A person's widths, order and choices are kept for the next visit. AG Grid
  // tells of each change a moment after it; bringing a layout back is told too,
  // and keeping it again changes nothing.
  api.addEventListener('columnResized', (event) => event.finished && remember(event.source));
  api.addEventListener('columnMoved', (event) => event.finished && remember(event.source));
  api.addEventListener('columnVisible', (event) => remember(event.source));
  /** Sizing the grid does by itself is not a choice to keep. */
  const automatic = new Set(['gridInitializing', 'flex', 'gridOptionsChanged', 'sizeColumnsToFit', 'autosizeColumns']);
  function remember(source: string) {
    // A grid taking itself apart also sends column events: they are not choices.
    if (automatic.has(source) || !preferences || api.isDestroyed()) return;
    const state = (api.getColumnState() ?? []).map(({ colId, width, flex, hide }) => ({ colId, width: width ?? null, flex: flex ?? null, hide: !!hide }));
    preferences.set(columnsKey, state);
  }
  const saved = preferences?.get(columnsKey);
  if (Array.isArray(saved)) {
    const known = new Set(api.getColumns()?.map((c) => c.getColId()));
    const state = (saved as { colId?: unknown }[]).filter((s) => typeof s?.colId === 'string' && known.has(s.colId)) as ColumnState[];
    api.applyColumnState({ state, applyOrder: true });
  }

  // ---- the column chooser: a short list of the columns a person may hide ----
  const chooserBox = document.createElement('div');
  chooserBox.className = 'fd-grid-chooser';
  chooserBox.setAttribute('role', 'group');
  chooserBox.setAttribute('aria-label', labels.chooseColumns);
  chooserBox.hidden = true;
  element.append(chooserBox);
  let opener: HTMLButtonElement | null = null;
  const closeChooser = (refocus: boolean) => {
    if (chooserBox.hidden) return;
    chooserBox.hidden = true;
    opener?.setAttribute('aria-expanded', 'false');
    if (refocus) api.setFocusedHeader('__delete');
  };
  function toggleChooser(button: HTMLButtonElement, fromKeyboard: boolean) {
    if (!chooserBox.hidden) return closeChooser(fromKeyboard);
    opener = button;
    chooserBox.replaceChildren(
      ...optionalIds.map((column) => {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.className = 'fd-checkbox';
        box.checked = api.getColumn(column)?.isVisible() ?? false;
        box.addEventListener('change', () => api.setColumnsVisible([column], box.checked));
        label.append(box, document.createTextNode(def.fields[column].label));
        return label;
      })
    );
    // Under the header's end, inside the grid's own box.
    const at = button.getBoundingClientRect();
    const frame = element.getBoundingClientRect();
    chooserBox.style.insetBlockStart = `${at.bottom - frame.top + 4}px`;
    chooserBox.style.insetInlineEnd = `${frame.right - at.right}px`;
    chooserBox.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    if (fromKeyboard) chooserBox.querySelector('input')?.focus();
  }
  chooserBox.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeChooser(true);
    }
  });
  const outside = (event: Event) => {
    const target = event.target as Node;
    if (!chooserBox.contains(target) && target !== opener) closeChooser(false);
  };
  document.addEventListener('mousedown', outside);
  chooserBox.addEventListener('focusout', (event) => {
    const next = event.relatedTarget as Node | null;
    if (next && !chooserBox.contains(next) && next !== opener) closeChooser(false);
  });

  // Asked for the focus after a refused save: open the first wrong cell for editing.
  element.addEventListener('fd-focus-problem', (event) => {
    const first = lineProblems()[0];
    if (!first) return;
    event.preventDefault();
    api.ensureIndexVisible(first.index);
    api.setFocusedCell(first.index, first.column);
    api.startEditingCell({ rowIndex: first.index, colKey: first.column });
  });

  const addButton = (text: string, values: Values, kind: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fd-button fd-button-link fd-lines-add';
    button.dataset['add'] = kind;
    button.textContent = `+ ${text}`;
    button.addEventListener('click', () => addAndEdit(values));
    adds.append(button);
  };
  addButton(labels.addLine, {}, 'line');
  if (kinds) {
    addButton(labels.addSection, { [kinds.field]: kinds.section ?? 'section' }, 'section');
    addButton(labels.addNote, { [kinds.field]: kinds.note ?? 'note' }, 'note');
  }

  // A focused cell that has no editor still answers keys: Space ticks yes/no,
  // and Enter or Space presses the delete button. (AG Grid's onCellKeyDown
  // arrives too late to stop Space scrolling the page.)
  host.addEventListener('keydown', (event) => {
    // Alt+Up/Down moves the focused line, for those who do not drag.
    // The totals row is not a line: its index counts among pinned rows, not lines.
    if (api.getFocusedCell()?.rowPinned) return;
    if (sequence && !readonly && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const focused = api.getFocusedCell();
      const line = focused ? api.getDisplayedRowAtIndex(focused.rowIndex)?.data : undefined;
      if (!focused || !line || api.getEditingCells().length) return;
      event.preventDefault();
      const to = focused.rowIndex + (event.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= lines().length) return;
      form.moveLine(name, line.key, to);
      api.setFocusedCell(to, focused.column);
      return;
    }
    if (readonly || (event.key !== ' ' && event.key !== 'Enter')) return;
    if (!(event.target as HTMLElement).classList.contains('ag-cell')) return; // a checkbox or an editor answers for itself
    const focused = api.getFocusedCell();
    const line = focused ? api.getDisplayedRowAtIndex(focused.rowIndex)?.data : undefined;
    if (!focused || !line) return;
    const column = focused.column.getColId();
    if (event.key === ' ' && def.fields[column]?.type === 'boolean' && !kindOf(line)) {
      event.preventDefault();
      form.updateLine(name, line.key, column, line.values[column] !== true);
    } else if (column === '__delete') {
      event.preventDefault();
      form.removeLine(name, line.key);
    }
  });

  // A table grows with its lines until it is long; then it keeps a height of
  // LONG_TABLE rows and scrolls inside, so hundreds of lines draw no more than fit.
  let long = false;
  const fitHeight = (count: number) => {
    if (count > LONG_TABLE === long) return;
    long = count > LONG_TABLE;
    host.style.height = long ? `${HEADER_HEIGHT + (LONG_TABLE + (totals.length ? 1 : 0)) * ROW_HEIGHT + 2}px` : '';
    api.setGridOption('domLayout', long ? 'normal' : 'autoHeight');
  };

  let shown: Line[] | null = null;
  let problemsShown = '';
  return {
    element,
    focus: () => {
      const column = firstEditable();
      if (lines().length && column) api.setFocusedCell(0, column);
      else adds.querySelector('button')?.focus();
    },
    update(state) {
      if (state.readonly !== readonly) {
        readonly = state.readonly;
        api.setGridOption('columnDefs', columnDefs.filter((c) => !(readonly && (c.colId === '__delete' || c.colId === '__handle'))));
      }
      adds.hidden = readonly;
      const current = (state.value as Line[] | null) ?? [];
      if (current !== shown) {
        shown = current;
        api.setGridOption('rowData', current);
        fitHeight(current.length);
        if (totals.length) api.setGridOption('pinnedBottomRowData', [totalsRow(current)]);
      }
      const found = readonly ? [] : lineProblems();
      const signature = found.map((p) => `${p.index}.${p.column}:${p.message}`).join('|');
      if (signature !== problemsShown) {
        problemsShown = signature;
        api.refreshCells({ force: true, suppressFlash: true });
        const listed = found.slice(0, 3).map((p) => fill(labels.lineProblem, { n: p.index + 1, message: p.message }));
        if (found.length > 3) listed.push(fill(labels.moreProblems, { n: found.length - 3 }));
        problems.textContent = listed.join(' · ');
        problems.hidden = !found.length;
      }
      element.setAttribute('aria-invalid', String(state.invalid || found.length > 0));
    },
    destroy() {
      document.removeEventListener('mousedown', outside);
      api.destroy();
      apis.delete(element);
    },
  };
};

/** Pass these to the viewer (`widgets`) to show one2many nodes marked `"widget": "grid"` in the grid. */
export const gridWidgets: Record<string, WidgetFactory> = { 'one2many.grid': gridWidget };
