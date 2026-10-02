import {
  AllCommunityModule,
  createGrid,
  themeQuartz,
  type ColDef,
  type GridApi,
  type ICellEditorComp,
  type ICellEditorParams,
  type ICellRendererComp,
  type ICellRendererParams,
} from 'ag-grid-community';
import type { Field, FieldNode, Form, Line, LineField, Value } from '@fieldia/core';
import { installGridStyles } from './styles';
import { createWidget, lineForm, WIDGET_LABELS, type Widget, type WidgetContext, type WidgetFactory, type WidgetLabels } from '@fieldia/widgets';

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
}

type LineDef = Extract<Field, { type: 'one2many' }>;

// ---- showing values -------------------------------------------------------------

const number = (value: number, digits: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

function localDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(text);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
}

/** A value as a person reads it in a cell. */
export function displayValue(def: LineField, value: Value | undefined, values: Record<string, Value> = {}): string {
  if (value === null || value === undefined || value === '') return '';
  switch (def.type) {
    case 'many2one':
    case 'reference':
      return (value as { label?: string }).label ?? '';
    case 'many2many':
      return ((value as { label: string }[]) ?? []).map((r) => r.label).join(', ');
    case 'selection': {
      const label = (v: unknown) => def.options.find((o) => o.value === v)?.label ?? String(v);
      return Array.isArray(value) ? value.map(label).join(', ') : label(value);
    }
    case 'integer':
      return number(Number(value), 0);
    case 'float':
      return number(Number(value), def.digits?.[1] ?? 2);
    case 'monetary': {
      const currency = def.currency ?? (def.currencyField ? (values[def.currencyField] as { label?: string } | null)?.label : undefined);
      const amount = number(Number(value), def.digits?.[1] ?? 2);
      return currency ? `${currency} ${amount}` : amount;
    }
    case 'date': {
      const date = localDate(String(value));
      return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : String(value);
    }
    case 'datetime': {
      const date = localDate(String(value));
      return date
        ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
        : String(value);
    }
    case 'html':
      return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    case 'binary':
    case 'image':
      return (value as { name?: string }).name ?? '';
    case 'boolean':
      return value ? '✓' : '';
    default:
      return String(value);
  }
}

// ---- cells ------------------------------------------------------------------------

/** Yes or no, ticked in place: no editor to open for one click. */
class CheckboxRenderer implements ICellRendererComp<Line> {
  private box!: HTMLInputElement;
  private params!: ICellRendererParams<Line> & { cell: CellContext; column: string };
  init(params: ICellRendererParams<Line> & { cell: CellContext; column: string }) {
    this.params = params;
    this.box = document.createElement('input');
    this.box.type = 'checkbox';
    this.box.className = 'fd-checkbox';
    this.box.setAttribute('aria-label', params.cell.defs[params.column].label);
    this.box.addEventListener('change', () => {
      const { cell, column, data } = this.params;
      if (data) cell.form.updateLine(cell.field, data.key, column, this.box.checked);
    });
    this.refresh(params);
  }
  getGui() {
    return this.box;
  }
  refresh(params: ICellRendererParams<Line> & { cell: CellContext; column: string }) {
    this.params = params;
    this.box.checked = params.data?.values[params.column] === true;
    this.box.disabled = params.cell.form.fieldReadonly(params.cell.field);
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

/** A cell being edited: the field's own Fieldia widget, writing straight into its line. */
class FieldiaCellEditor implements ICellEditorComp<Line> {
  private box!: HTMLElement;
  private widget!: Widget;
  private leave = () => undefined as void;
  private params!: ICellEditorParams<Line> & { cell: CellContext; column: string };

  init(params: ICellEditorParams<Line> & { cell: CellContext; column: string }) {
    this.params = params;
    const { cell, column } = params;
    const key = params.data.key;
    const def = cell.defs[column];
    const node: FieldNode = { type: 'field', id: `${cell.fieldId}.${key}.${column}`, field: column };
    const context: WidgetContext = {
      form: lineForm(cell.form, cell.field, key),
      name: column,
      field: def as Field,
      node,
      id: `${cell.fieldId}-${key}-${column}-editor`,
      document,
      labels: cell.labels,
    };
    this.widget = createWidget(context, cell.registry);
    this.box = document.createElement('div');
    this.box.className = 'fd-grid-editor';
    this.box.dataset['type'] = def.type;
    this.box.setAttribute('aria-label', def.label);
    this.box.append(this.widget.element);
    const show = () => {
      const line = this.line();
      this.widget.update({ value: line?.values[column], values: line?.values ?? {}, readonly: false, required: def.required === true, invalid: false });
    };
    show();
    this.leave = cell.form.subscribe(show);
  }
  private line(): Line | undefined {
    const lines = (this.params.cell.form.getState().values[this.params.cell.field] as Line[] | null) ?? [];
    return lines.find((l) => l.key === this.params.data.key);
  }
  getGui() {
    return this.box;
  }
  afterGuiAttached() {
    this.widget.focus();
    const input = this.box.querySelector('input');
    if (input && input.type !== 'checkbox' && document.activeElement === input) input.select();
  }
  getValue() {
    return this.line()?.values[this.params.column];
  }
  /** Lists that open below their input need room the cell does not have. */
  isPopup() {
    const type = this.params.cell.defs[this.params.column].type;
    return type === 'many2one' || type === 'many2many' || type === 'reference';
  }
  getPopupPosition(): 'over' {
    return 'over';
  }
  destroy() {
    this.leave();
    this.widget.destroy?.();
  }
}

// ---- the widget -------------------------------------------------------------------

const EDITABLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'date', 'datetime', 'selection', 'many2one', 'many2many', 'reference']);

export const gridWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en }) => {
  const def = field as LineDef;
  const columns = (node.columns ?? Object.keys(def.fields)).filter((column) => def.fields[column]);
  const cell: CellContext = { form, field: name, fieldId: node.id, defs: def.fields, labels };
  installGridStyles(document);

  const element = document.createElement('div');
  element.className = 'fd-grid-lines';
  element.id = id;
  element.setAttribute('role', 'group');
  const host = document.createElement('div');
  host.className = 'fd-grid-host';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'fd-button fd-button-link fd-lines-add';
  add.textContent = `+ ${labels.addLine}`;
  element.append(host, add);

  let readonly = false;
  const lines = () => (form.getState().values[name] as Line[] | null) ?? [];
  const firstEditable = () => columns.find((c) => EDITABLE.has(def.fields[c].type) && !def.fields[c].readonly);

  const columnDefs: ColDef<Line>[] = columns.map((column) => {
    const sub = def.fields[column];
    const numeric = sub.type === 'integer' || sub.type === 'float' || sub.type === 'monetary';
    // Words get the room; numbers and yes/no take what they need.
    const wide = ['char', 'text', 'html', 'many2one', 'many2many', 'reference', 'selection'].includes(sub.type);
    const base: ColDef<Line> = {
      colId: column,
      headerName: sub.label,
      valueGetter: (p) => p.data?.values[column],
      valueFormatter: (p) => displayValue(sub, p.value as Value, p.data?.values ?? {}),
      type: numeric ? 'rightAligned' : undefined,
      minWidth: wide ? 140 : sub.type === 'monetary' ? 130 : 96,
      flex: wide ? 2 : sub.type === 'monetary' ? 1.3 : 1,
    };
    if (sub.type === 'boolean') {
      return { ...base, cellRenderer: CheckboxRenderer, cellRendererParams: { cell, column }, editable: false, flex: 0, width: 100, minWidth: 80 };
    }
    return {
      ...base,
      editable: () => !readonly && EDITABLE.has(sub.type) && !sub.readonly,
      cellEditor: FieldiaCellEditor,
      cellEditorParams: { cell, column },
    };
  });
  columnDefs.push({
    colId: '__delete',
    headerName: '',
    width: 44,
    minWidth: 44,
    maxWidth: 44,
    cellClass: 'fd-grid-tools',
    resizable: false,
    sortable: false,
    suppressMovable: true,
    cellRenderer: DeleteRenderer,
    cellRendererParams: { cell },
  });

  const api = createGrid<Line>(
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
        rowHeight: 40,
        headerHeight: 38,
      }),
      columnDefs,
      rowData: lines(),
      getRowId: (p) => p.data.key,
      domLayout: 'autoHeight',
      // A table that grows to fit its rows draws them all anyway, and lines have few columns.
      suppressRowVirtualisation: true,
      suppressColumnVirtualisation: true,
      readOnlyEdit: true,
      // An empty table shows its Add a line button below, not a message inside.
      suppressNoRowsOverlay: true,
      singleClickEdit: true,
      stopEditingWhenCellsLoseFocus: true,
      animateRows: false,
      suppressMovableColumns: false,
      defaultColDef: { sortable: false, resizable: true },
    },
    { modules: [AllCommunityModule] }
  );
  apis.set(element, api);

  add.addEventListener('click', () => {
    const key = form.addLine(name);
    const index = lines().findIndex((l) => l.key === key);
    const column = firstEditable();
    if (index >= 0 && column) {
      api.ensureIndexVisible(index);
      api.setFocusedCell(index, column);
      api.startEditingCell({ rowIndex: index, colKey: column });
    }
  });

  let shown: Line[] | null = null;
  return {
    element,
    focus: () => {
      const column = firstEditable();
      if (lines().length && column) api.setFocusedCell(0, column);
      else add.focus();
    },
    update(state) {
      if (state.readonly !== readonly) {
        readonly = state.readonly;
        api.setGridOption('columnDefs', columnDefs.filter((c) => !(readonly && c.colId === '__delete')));
      }
      add.hidden = readonly;
      const current = (state.value as Line[] | null) ?? [];
      if (current !== shown) {
        shown = current;
        api.setGridOption('rowData', current);
      }
    },
    destroy() {
      api.destroy();
      apis.delete(element);
    },
  };
};

/** Pass these to the viewer (`widgets`) to show one2many nodes marked `"widget": "grid"` in the grid. */
export const gridWidgets: Record<string, WidgetFactory> = { 'one2many.grid': gridWidget };
