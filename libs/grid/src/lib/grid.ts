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
import { fill, isRightToLeft, lineKind, type ButtonNode, type Field, type Locale, type FieldNode, type Form, type Line, type LineField, type LineKinds, type LineState, type Value, type Values } from '@fieldia/core';
import { installGridStyles } from './styles';
import {
  cellText,
  createWidget,
  distributionIds,
  distributionModel,
  distributionWords,
  DRAWN_IN_CELLS,
  drawIcon,
  openLineDialog,
  kindTextField,
  lineForm,
  WIDGET_LABELS,
  type WidgetDialogs,
  type Widget,
  type WidgetContext,
  type WidgetFactory,
  type WidgetLabels,
} from '@fieldia/widgets';

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
/** The tones a line or a cell can take. */
const TONES = ['info', 'success', 'warning', 'danger', 'muted'] as const;

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
  /** The widgets columns are typed with, by column — hours as HH:MM, a per cent — and their settings, a calendar's week numbers. */
  looks?: Record<string, { widget?: string; options?: FieldNode['options'] }>;
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

/** A line's own buttons, each shown by its condition on the line; a press runs with the line. */
class RowButtonsRenderer implements ICellRendererComp<Line> {
  private box!: HTMLElement;
  private params!: ICellRendererParams<Line> & RowButtonsParams;
  init(params: ICellRendererParams<Line> & RowButtonsParams) {
    this.params = params;
    this.box = document.createElement('span');
    this.box.className = 'fd-grid-row-buttons';
    for (const own of params.buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      const icon = drawIcon(document, own.icon);
      button.className = `fd-button fd-button-link fd-line-button${icon ? ' fd-line-button-icon' : ''}`;
      button.dataset['rowButton'] = own.id;
      button.setAttribute('aria-label', own.label);
      button.title = own.label;
      button.append(icon ?? own.label);
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const key = this.params.data?.key;
        if (!key || button.hasAttribute('aria-busy')) return;
        button.setAttribute('aria-busy', 'true');
        try {
          await params.press(own.id, key);
        } finally {
          button.removeAttribute('aria-busy');
        }
      });
      this.box.append(button);
    }
    this.show();
  }
  private show() {
    const state = this.params.data ? this.params.stateOf(this.params.data.key) : undefined;
    for (const button of this.box.querySelectorAll<HTMLButtonElement>('button')) button.hidden = !state?.buttons[button.dataset['rowButton'] as string];
  }
  getGui() {
    return this.box;
  }
  refresh(params: ICellRendererParams<Line> & RowButtonsParams) {
    this.params = params;
    this.show();
    return true;
  }
}

interface RowButtonsParams {
  buttons: readonly ButtonNode[];
  stateOf(key: string): LineState | undefined;
  press(id: string, key: string): Promise<unknown>;
}

/** A choice drawn as a pill in the tone its rules give it: Flectra's widget="badge". */
class BadgeRenderer implements ICellRendererComp<Line> {
  private pill!: HTMLElement;
  init(params: ICellRendererParams<Line> & { toneOf(line: Line | undefined): string | null }) {
    this.pill = document.createElement('span');
    this.refresh(params);
  }
  getGui() {
    return this.pill;
  }
  refresh(params: ICellRendererParams<Line> & { toneOf(line: Line | undefined): string | null }) {
    const text = params.valueFormatted ?? String(params.value ?? '');
    this.pill.className = text ? 'fd-grid-badge' : '';
    this.pill.textContent = text;
    const tone = params.toneOf(params.data);
    if (tone) this.pill.dataset['tone'] = tone;
    else delete this.pill.dataset['tone'];
    return true;
  }
}

/** What an analytic distribution's cell needs: the accounts' names as they are found, and finding those not known yet. */
interface DistributionParams {
  /** The model the accounts are records of. */
  model: string;
  locale?: Locale;
  nameOf(id: string): string | undefined;
  find(line: Line, ids: string[]): void;
}

/** An analytic distribution's cell: each account by its name and its share, "Sales 60%, Marketing 40%"; its editor opens its lines. */
class DistributionRenderer implements ICellRendererComp<Line> {
  private text!: HTMLElement;
  init(params: ICellRendererParams<Line> & DistributionParams) {
    this.text = document.createElement('span');
    this.text.className = 'fd-grid-distribution';
    this.refresh(params);
  }
  getGui() {
    return this.text;
  }
  refresh(params: ICellRendererParams<Line> & DistributionParams) {
    const value = params.value as Value | undefined;
    const unknown = distributionIds(value).map(String).filter((id) => params.nameOf(id) === undefined);
    if (unknown.length && params.data) params.find(params.data, unknown);
    this.text.textContent = distributionWords(value, params.locale, params.nameOf);
    // All of it on pointing at it, when the column is narrower than its words.
    this.text.title = this.text.textContent;
    return true;
  }
}

/** What a cell drawn by a widget of its own needs: the widget, and whether its line's cell is read-only now. */
interface DrawnParams {
  cell: CellContext;
  subfield: string;
  look: { widget: string; options?: FieldNode['options'] };
  locked(line: Line | undefined): boolean;
}

/**
 * A cell drawn by a widget of its own — a progress bar, priority stars, a
 * state's dot — used in the cell itself with a click, as the plain table's
 * are: the same Fieldia widget, wired to its line.
 */
class DrawnRenderer implements ICellRendererComp<Line> {
  private box!: HTMLElement;
  private widget: Widget | null = null;
  init(params: ICellRendererParams<Line> & DrawnParams) {
    this.box = document.createElement('span');
    this.box.className = 'fd-grid-drawn';
    const { cell, subfield, look, data } = params;
    if (data) {
      const node: FieldNode = { type: 'field', id: `${cell.fieldId}.${data.key}.${subfield}`, field: subfield, widget: look.widget, ...(look.options ? { options: look.options } : {}) };
      this.widget = createWidget(
        { form: lineForm(cell.form, cell.field, data.key), name: subfield, field: cell.defs[subfield] as Field, node, id: `${cell.fieldId}-${data.key}-${subfield}-cell`, document, labels: cell.labels, locale: cell.locale, dialogs: cell.dialogs },
        cell.registry
      );
      // Named by its column, as the plain table's cell is by its hidden label.
      const named = this.widget.element.matches('[role]') ? this.widget.element : this.widget.element.querySelector('[role]');
      named?.setAttribute('aria-label', cell.defs[subfield].label);
      this.box.append(this.widget.element);
    }
    this.refresh(params);
  }
  getGui() {
    return this.box;
  }
  refresh(params: ICellRendererParams<Line> & DrawnParams) {
    const { cell, subfield, data } = params;
    this.widget?.update({
      value: data?.values[subfield],
      values: data?.values ?? {},
      parent: cell.form.getState().values,
      readonly: params.locked(data),
      required: false,
      invalid: false,
    });
    return true;
  }
  destroy() {
    this.widget?.destroy?.();
  }
}

/** The delete button at the end of each line: hidden on a line the table keeps (`lineDelete`). */
class DeleteRenderer implements ICellRendererComp<Line> {
  private button!: HTMLButtonElement;
  private params!: ICellRendererParams<Line> & { cell: CellContext; deletable(key: string): boolean };
  init(params: ICellRendererParams<Line> & { cell: CellContext; deletable(key: string): boolean }) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'fd-line-delete';
    this.button.textContent = '×';
    this.button.setAttribute('aria-label', params.cell.labels.deleteLine);
    this.button.addEventListener('click', () => {
      const key = this.params.data?.key;
      if (key && this.params.deletable(key)) this.params.cell.form.removeLine(this.params.cell.field, key);
    });
    this.refresh(params);
  }
  getGui() {
    return this.button;
  }
  refresh(params: ICellRendererParams<Line> & { cell: CellContext; deletable(key: string): boolean }) {
    this.params = params;
    this.button.hidden = !params.data || !params.deletable(params.data.key);
    return true;
  }
}

/** What a line's tick and the head's tick need from their grid: which lines are chosen, and choosing them. */
interface Picking {
  label(index: number): string;
  allLabel: string;
  isChosen(key: string): boolean;
  choose(key: string, on: boolean): void;
  chooseAll(on: boolean): void;
  /** The head's tick, kept up to date by the grid. */
  head(box: HTMLInputElement): void;
  readonly(): boolean;
}

/** A line's tick, choosing it for the table's buttons for chosen lines. */
class PickRenderer implements ICellRendererComp<Line> {
  private box!: HTMLInputElement;
  private params!: ICellRendererParams<Line> & { picking: Picking };
  init(params: ICellRendererParams<Line> & { picking: Picking }) {
    this.box = document.createElement('input');
    this.box.type = 'checkbox';
    this.box.className = 'fd-checkbox fd-line-pick';
    this.box.addEventListener('change', () => {
      if (this.params.data) this.params.picking.choose(this.params.data.key, this.box.checked);
    });
    this.refresh(params);
  }
  getGui() {
    return this.box;
  }
  refresh(params: ICellRendererParams<Line> & { picking: Picking }) {
    this.params = params;
    this.box.checked = !!params.data && params.picking.isChosen(params.data.key);
    this.box.disabled = params.picking.readonly();
    this.box.setAttribute('aria-label', params.picking.label((params.node.rowIndex ?? 0) + 1));
    return true;
  }
}

/** The head's tick: every line chosen, or none. */
class PickAllHeader implements IHeaderComp {
  private box!: HTMLInputElement;
  init(params: IHeaderParams & { picking: Picking }) {
    this.box = document.createElement('input');
    this.box.type = 'checkbox';
    this.box.className = 'fd-checkbox fd-line-pick fd-line-pick-all';
    this.box.setAttribute('aria-label', params.picking.allLabel);
    this.box.addEventListener('change', () => params.picking.chooseAll(this.box.checked));
    params.picking.head(this.box);
  }
  getGui() {
    return this.box;
  }
  refresh() {
    return true;
  }
}

/** The button that puts a copy of a line right after it. */
class CopyRenderer implements ICellRendererComp<Line> {
  private button!: HTMLButtonElement;
  private params!: ICellRendererParams<Line> & { copy(key: string): void; label(index: number): string };
  init(params: ICellRendererParams<Line> & { copy(key: string): void; label(index: number): string }) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'fd-line-copy';
    this.button.textContent = '⧉';
    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.params.data) this.params.copy(this.params.data.key);
    });
    this.refresh(params);
  }
  getGui() {
    return this.button;
  }
  refresh(params: ICellRendererParams<Line> & { copy(key: string): void; label(index: number): string }) {
    this.params = params;
    const label = params.label((params.node.rowIndex ?? 0) + 1);
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
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

/** What an empty grid says in its body: the page's words (`emptyLabel`), or a short line of its own. */
class EmptyOverlay {
  private line!: HTMLElement;
  init(params: { words: string }) {
    this.line = document.createElement('span');
    this.line.className = 'fd-help fd-grid-empty';
    this.line.textContent = params.words;
  }
  getGui() {
    return this.line;
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
  /** A section or note being edited, not an item. */
  private kind: 'section' | 'note' | null = null;
  private note: HTMLTextAreaElement | null = null;

  init(params: ICellEditorParams<Line> & { cell: CellContext; subfield: string }) {
    this.params = params;
    // Not `column`: AG Grid's own params carry the column object under that name.
    const { cell } = params;
    const key = params.data.key;
    const kind = (this.kind = cell.kindOf(params.data));
    const column = (this.column = kind && cell.kinds ? cell.kinds.text : params.subfield);
    const def = (this.def = kind ? kindTextField(cell.defs[column], kind) : cell.defs[column]);
    // A cell typed in its own way (hours as HH:MM, a per cent) is typed so in its editor too.
    const look = kind ? undefined : cell.looks?.[column];
    const node: FieldNode = { type: 'field', id: `${cell.fieldId}.${key}.${column}`, field: column, ...(look?.widget ? { widget: look.widget } : {}), ...(look?.options ? { options: look.options } : {}) };
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
    else if (def.type === 'text') this.paragraph(this.box.querySelector('textarea'));
    if (this.isPopup()) {
      // AG Grid places a popup over its cell but leaves its size to the editor; a distribution's lines take the room they need.
      const { width, height } = params.eGridCell.getBoundingClientRect();
      if (def.type === 'json') Object.assign(this.box.style, { minWidth: `${Math.max(width, 360)}px` });
      // Tags wrap in a box of their own, as wide as a few need and as tall as they take, never spilling over the lines around.
      else if (def.type === 'many2many') Object.assign(this.box.style, { minWidth: `${Math.max(width, 280)}px`, minHeight: `${height}px` });
      // A paragraph is typed in a box of several lines, wide enough to read them, never spilling over the rows around.
      else if (def.type === 'text') Object.assign(this.box.style, { minWidth: `${Math.max(width, 320)}px`, minHeight: `${height}px` });
      // A date is as wide as its day and time need (the stylesheet's max-content), its cell's width at the least.
      else if (def.type === 'date' || def.type === 'datetime') Object.assign(this.box.style, { minWidth: `${width}px`, height: `${height}px` });
      else Object.assign(this.box.style, { width: `${width}px`, height: `${height}px` });
    }
    // The form never changes values in place, so holding them is enough.
    this.before = this.line()?.values ?? {};
    // A key the widget used itself (Enter picking from its list, Escape closing it) is not the grid's.
    this.box.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) _stopPropagationForAgGrid(event);
      else if (event.key === 'Escape') params.cell.cancel(key, this.before);
    });
    // A day picked from a date's calendar is the whole answer: the cell keeps it and closes, as a
    // spreadsheet's does. The browser says change while a date is typed too (once the year makes
    // one), so a change right after a key is typing, which Enter or Tab commits. A date with a time
    // stays open for its time, and a whole line open at once stays open.
    if (def.type === 'date' && !cell.rowMode) {
      let typedAt = 0;
      this.box.addEventListener('keydown', () => (typedAt = Date.now()), true);
      this.box.addEventListener('change', (event) => {
        if ((event.target as HTMLInputElement).type !== 'date' || Date.now() - typedAt < 500) return;
        params.stopEditing();
      });
      // Fieldia's own calendar (options.weekNumbers) sets the day itself, and says it was picked.
      this.box.addEventListener('fd-picked', () => params.stopEditing());
    }
    // Like a spreadsheet, a cell reached from the keyboard has its text selected,
    // so typing replaces it; a click still puts the caret where it lands.
    let pointing = false;
    this.box.addEventListener('pointerdown', () => (pointing = true));
    this.box.addEventListener('focusin', (event) => {
      const input = event.target;
      if (!pointing && input instanceof HTMLInputElement && input.type !== 'checkbox' && input.type !== 'radio') selectFromStart(input);
      pointing = false;
    });
    // A value longer than its cell has room for takes the cell's padding too.
    this.box.addEventListener('input', () => this.fit());
    const show = () => {
      const line = this.line();
      // A cell the form found wrong stays marked while it is fixed.
      const invalid = !!cell.form.getState().errors[`${cell.field}.${key}.${column}`];
      this.box.classList.toggle('fd-grid-editor-invalid', invalid);
      this.widget.update({ value: line?.values[column], values: line?.values ?? {}, parent: cell.form.getState().values, readonly: false, required: def.required === true, invalid });
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
   * A paragraph (a text field) is typed in a box of several lines over its
   * cell: Enter makes a new line there, and Ctrl/Cmd+Enter finishes it, as a
   * note's does.
   */
  private paragraph(area: HTMLTextAreaElement | null) {
    if (!area) return;
    area.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.altKey) return;
      _stopPropagationForAgGrid(event);
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      this.params.api.stopEditing();
    });
  }
  /** A value wider than the room inside the cell's padding takes the padding too, so more of it shows. */
  private fit() {
    const input = this.box.querySelector<HTMLInputElement>('input:not([type="checkbox"]):not([type="radio"])');
    if (!input || this.isPopup()) return;
    if (input.scrollWidth > input.clientWidth) this.box.classList.add('fd-grid-editor-tight');
  }
  /** A note's box as tall as its text, and its row with it. */
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
    this.fit();
    // With a whole line open, every editor is attached: only the one clicked takes the focus.
    if (this.params.cellStartedEdit === false) return;
    this.widget.focus();
    if (this.note) {
      this.note.setSelectionRange(this.note.value.length, this.note.value.length);
      this.resize();
      return;
    }
    const input = this.box.querySelector('input');
    if (input && input.type !== 'checkbox' && document.activeElement === input) selectFromStart(input);
  }
  getValue() {
    return this.line()?.values[this.column];
  }
  /**
   * Lists that open below their input need room the cell does not have (a whole open line floats them instead); so do a
   * distribution's lines, a date wider than its cell, and a paragraph's several lines (a note's grow in its own row).
   */
  isPopup() {
    if (this.params.cell.rowMode) return false;
    const type = this.def.type;
    return type === 'many2one' || type === 'many2many' || type === 'reference' || type === 'json' || type === 'date' || type === 'datetime' || (type === 'text' && !this.kind);
  }
  getPopupPosition(): 'over' {
    return 'over';
  }
  destroy() {
    this.leave();
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

/**
 * A box's text selected so typing replaces it, shown from its start: a
 * browser scrolls a long value to its end as it is selected, and its start is
 * what reads. (A date's own input has no text selection to set.)
 */
function selectFromStart(input: HTMLInputElement) {
  try {
    input.setSelectionRange(0, input.value.length, 'backward');
  } catch {
    input.select();
  }
  input.scrollLeft = 0;
}

// ---- the widget -------------------------------------------------------------------

/** Past this many lines a table stops growing and scrolls inside, drawing only the rows in view. */
const LONG_TABLE = 15;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 38;

const EDITABLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'date', 'datetime', 'selection', 'many2one', 'many2many', 'reference']);

/** The kinds of field that hold words: a line is named by the first of them. */
const WORDS = new Set(['char', 'text', 'html', 'many2one', 'reference']);

/** The kinds of field whose column is as wide as its values need, in characters, as Flectra's lists size them. */
const FIXED_CHARS: Partial<Record<string, number>> = { boolean: 4, integer: 4, float: 6, monetary: 14, date: 11, datetime: 17 };

export const gridWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, preferences, locale, dialogs }) => {
  const def = field as LineDef;
  const kinds = def.lineKinds;
  const sequence = def.sequenceField;
  // The fields that say what a line is and keep the lines' order never show as columns.
  // Lines a line holds are edited in its form, never drawn in its row.
  const columns = (node.columns ?? Object.keys(def.fields)).filter((column) => def.fields[column] && def.fields[column].type !== 'one2many' && column !== kinds?.field && column !== sequence);
  const kindOf = (line: Line | undefined) => (line ? lineKind(def, line.values) : null);
  // Its columns run the way the page reads; a column held at the start or the end of the line is held at that side.
  const rtl = !!locale && isRightToLeft(locale);
  const lineStart = rtl ? 'right' : 'left';
  const lineEnd = rtl ? 'left' : 'right';
  // The table's own rules, read by the form for each line as the form changes; a table with none asks nothing.
  const ruled = !!(node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons || node.lineDelete !== undefined);
  let lineStates = new Map<string, LineState>();
  /** Accounts' names an analytic distribution's cells show, by model and id, as they are found. */
  const accountNames = new Map<string, string>();
  /** The analytic distributions among the columns, by column: their names found and said. */
  const distributions = new Map<string, DistributionParams>();
  /** Whether a line may be deleted now: always, unless the table's lineDelete keeps it. */
  const deletable = (key: string) => node.lineDelete === undefined || (lineStates.get(key) ?? form.lineState(node.id, key)).deletable;
  const ruleOf = (line: Line | undefined, column: string) => (line ? lineStates.get(line.key)?.cells[column] : undefined);
  /** Columns hidden by the record now. */
  let ruleHidden = new Set<string>();
  /** The record's fields its money takes its currency from (`parent.currency_id`), and their values when last drawn. */
  const parentCurrencies = [...new Set(Object.values(def.fields).flatMap((sub) => (sub.type === 'monetary' && sub.currencyField?.startsWith('parent.') ? [sub.currencyField.slice('parent.'.length)] : [])))];
  let currencyShown = '';
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
    // Columns typed in a widget's own way, or with settings of their own (a calendar's week numbers): drawn ones are used in their cells instead.
    looks: Object.fromEntries(
      Object.entries(node.cells ?? {}).flatMap(([column, rules]): [string, { widget?: string; options?: FieldNode['options'] }][] =>
        rules.widget ? (DRAWN_IN_CELLS.has(rules.widget) ? [] : [[column, { widget: rules.widget, ...(rules.options ? { options: rules.options } : {}) }]]) : rules.options ? [[column, { options: rules.options }]] : []
      )
    ),
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
  // Lines chosen for the table's buttons for them: a bar of those buttons over the grid while any is.
  const choosing = !!node.selectedButtons?.length;
  const chosen = new Set<string>();
  let pickAll: HTMLInputElement | null = null;
  const chosenCount = document.createElement('span');
  chosenCount.className = 'fd-lines-chosen-count';
  chosenCount.setAttribute('role', 'status');
  /** A press that waits for its run, and is not pressed again meanwhile. */
  const pressed = async (button: HTMLButtonElement, run: () => Promise<unknown>) => {
    if (button.hasAttribute('aria-busy')) return;
    button.setAttribute('aria-busy', 'true');
    try {
      await run();
    } finally {
      button.removeAttribute('aria-busy');
    }
  };
  const ownButton = (own: ButtonNode, className: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset['node'] = own.id;
    const icon = drawIcon(document, own.icon);
    if (icon) button.append(icon);
    button.append(own.label);
    return button;
  };
  const chosenButtons = (node.selectedButtons ?? []).map((own) => {
    const button = ownButton(own, `fd-button fd-button-${own.style ?? 'secondary'} fd-lines-chosen-button`);
    // In the table's order, whatever order they were ticked in.
    button.addEventListener('click', () => void pressed(button, () => form.runLinesAction(node.id, own.id, lines().filter((line) => chosen.has(line.key)).map((line) => line.key))));
    return { id: own.id, button };
  });
  const bar = document.createElement('div');
  bar.className = 'fd-lines-chosen';
  bar.hidden = true;
  bar.append(chosenCount, ...chosenButtons.map((b) => b.button));
  // Lines as cards too (cards: narrow or always): the stylesheet shows them in the grid's place on a narrow form.
  const cardList = document.createElement('div');
  cardList.className = 'fd-line-cards';
  if (node.cards) element.dataset['cards'] = node.cards;
  element.append(...(choosing ? [bar] : []), ...(node.cards ? [cardList] : []), host, problems, adds);

  let readonly = false;
  const lines = () => (form.getState().values[name] as Line[] | null) ?? [];
  /** A line field no one types in: read-only, or worked out from the line's others. */
  const locked = (sub: LineField) => sub.readonly === true || sub.compute !== undefined;
  const firstEditable = () => columns.find((c) => EDITABLE.has(def.fields[c].type) && !locked(def.fields[c]));
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
    // A line added a moment ago is taken back, unless the table keeps it: then it stays, as it was begun.
    if (fresh.delete(key)) return deletable(key) ? form.removeLine(name, key) : undefined;
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

  // Each column's share of the width by what it holds, as Flectra's lists size theirs: yes/no, numbers and dates by
  // their kind, words and links by the longest the lines have — a long name gets the room a short code does not need.
  const linesOf = (value: unknown) => ((value as Line[] | null) ?? []).filter((line) => !kindOf(line));
  const drawnFirst = linesOf(form.getState().values[name]);
  /** A column whose values are drawn as pills (widget="badge"). */
  const badged = (column: string) => !!node.cells?.[column]?.badge || node.cells?.[column]?.widget === 'badge';
  /** Whether a column is as wide as its values, not a share of the width: yes/no, numbers, money, dates and badges, unless the grid shrinks to fit. */
  const fixedWidth = (column: string) => (!!FIXED_CHARS[def.fields[column].type] || badged(column)) && node.fit !== 'shrink';
  /** The room a column's values need, in pixels: its longest value, its kind's least, a short label — and the cell's padding. */
  const roomOf = (column: string, lines = drawnFirst) => {
    const sub = def.fields[column];
    const least = FIXED_CHARS[sub.type] ?? 6;
    let longest = sub.type === 'boolean' ? 0 : lines.reduce((most, line) => Math.max(most, cellText(sub, line.values[column] as Value, line.values, locale, form.getState().values, node.cells?.[column]).length), 0);
    // A badge may turn to any of its choices: room for the longest, though no line holds it yet.
    if (badged(column) && sub.type === 'selection') longest = sub.options.reduce((most, option) => Math.max(most, option.label.length), longest);
    // A long label over short numbers wraps onto a second line rather than widen its column; only its longest word sets a floor.
    return Math.round(Math.min(Math.max(longest, least, labelWord(column)), 40) * 7.6 + 40);
  };
  /** Its label's longest word, in characters: a wrapping header breaks between words, never inside one. */
  const labelWord = (column: string) => Math.min(Math.max(0, ...def.fields[column].label.split(/\s+/).map((word) => word.length)), 12);
  /** The column a line is named by: its first of words (a name, a description, a link), else its first. */
  const titleColumn = (shown: string[]) => shown.find((column) => WORDS.has(def.fields[column].type)) ?? shown[0];
  /** A line's name by its place, "Line 3", when it has none to show. */
  const placeName = (n: number) => {
    const text = fill(labels.lineN, { n });
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  };

  const columnDefs: ColDef<Line>[] = columns.map((column) => {
    const sub = def.fields[column];
    const room = roomOf(column);
    const numeric = sub.type === 'integer' || sub.type === 'float' || sub.type === 'monetary';
    // Words get the room; numbers and yes/no take what they need.
    const wide = ['char', 'text', 'html', 'many2one', 'many2many', 'reference', 'selection'].includes(sub.type);
    /** Whether this column is where a section's or note's text starts. */
    const spans = (api: GridApi<Line>) => spanStart(api)?.getColId() === column;
    /** An analytic distribution (a json line field shown as `distribution`): its cell says its accounts, its editor opens its lines. */
    const distributed = sub.type === 'json' && node.cells?.[column]?.widget === 'distribution';
    const base: ColDef<Line> = {
      colId: column,
      headerName: sub.label,
      // A long label wraps onto a second line rather than be cut, so two columns never read the same; all of it on pointing at it.
      headerTooltip: sub.label,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      valueGetter: (p) => {
        if (p.node?.rowPinned) {
          if (totals.includes(column)) return p.data?.values[column];
          return spans(p.api) ? labels.total : null;
        }
        if (!kindOf(p.data)) return p.data?.values[column];
        return kinds && spans(p.api) ? p.data?.values[kinds.text] : null;
      },
      valueFormatter: (p) =>
        kindOf(p.data) || (p.node?.rowPinned && !totals.includes(column))
          ? String(p.value ?? '')
          : // Hidden by its line, the cell stays, blank, so the column lines up.
            ruleOf(p.data, column)?.invisible
            ? ''
            : cellText(sub, p.value as Value, p.data?.values ?? {}, locale, form.getState().values, node.cells?.[column]),
      type: numeric ? 'rightAligned' : undefined,
      // A section or note runs across every column but the delete button.
      colSpan: (p) => (kindOf(p.data) && spans(p.api) ? spanWidth(p.api) : 1),
      // Rows are measured, so a note of several lines shows all of them.
      autoHeight: !!kinds,
      cellClassRules: {
        'fd-grid-kind-text': (p) => !!kindOf(p.data),
        'fd-grid-invalid': (p) => !p.node.rowPinned && !!problemAt(p.data, column, p.api),
        'fd-cell-bold': (p) => !!ruleOf(p.data, column)?.bold,
        ...Object.fromEntries(TONES.map((tone) => [`fd-tone-${tone}`, (p: { data: Line | undefined }) => ruleOf(p.data, column)?.tone === tone])),
      },
      tooltipValueGetter: (p) => (p.node?.rowPinned ? undefined : problemAt(p.data, column, p.api)),
      suppressKeyboardEvent: keys,
      // Numbers, money and dates as wide as their values, never cut; words share the rest by the room they need, giving way when it is tight.
      minWidth: fixedWidth(column) ? 48 : Math.max(96, Math.round(labelWord(column) * 7.6 + 40)),
      ...(fixedWidth(column) ? { width: room } : { flex: room }),
      hide: optional[column] === 'hide',
      ...(node.cells?.[column]?.width ? { width: node.cells[column].width! * 8 + 32, flex: 0 } : {}),
      // Columns as wide as what they hold (fit: content), sized once the lines are drawn.
      ...(node.fit === 'content' && !node.cells?.[column]?.width ? { flex: undefined, minWidth: 64 } : {}),
      // Columns that shrink to fit (fit: shrink), as Flectra's list beside a chatter: narrower before the table scrolls, headers wrapping.
      ...(node.fit === 'shrink' ? { minWidth: wide ? 72 : sub.type === 'monetary' ? 80 : 48 } : {}),
      editable: (p) => {
        if (readonly || p.node.rowPinned) return false;
        if (kindOf(p.data)) return spans(p.api);
        const rules = ruleOf(p.data, column);
        return sub.type !== 'boolean' && (EDITABLE.has(sub.type) || distributed) && !locked(sub) && !rules?.readonly && !rules?.invisible;
      },
      cellEditor: FieldiaCellEditor,
      cellEditorParams: { cell, subfield: column },
    };
    if (distributed) {
      const model = distributionModel(node.cells?.[column]?.options);
      const asked = new Set<string>();
      const params: DistributionParams = {
        model,
        locale,
        nameOf: (id) => accountNames.get(`${model}:${id}`),
        find(line, ids) {
          const fresh = ids.filter((id) => !asked.has(`${model}:${id}`));
          if (!fresh.length) return;
          for (const id of fresh) asked.add(`${model}:${id}`);
          form.searchLine(name, line.key, column, '', fresh.length, { model, ids: fresh.map((id) => (/^\d+$/.test(id) ? Number(id) : id)) }).then(
            (found) => {
              for (const record of found) accountNames.set(`${model}:${record.id}`, record.label);
              if (api.isDestroyed()) return;
              api.refreshCells({ columns: [column], force: true, suppressFlash: true });
              // The cards say the accounts by their names too.
              cardsDrawn = '';
              drawCards();
            },
            () => undefined
          );
        },
      };
      distributions.set(column, params);
      return {
        ...base,
        // Its accounts' names take room, as words do.
        minWidth: node.fit === 'shrink' ? 96 : 180,
        flex: 2,
        cellRendererSelector: (p) => (kindOf(p.data) || p.node.rowPinned ? undefined : { component: DistributionRenderer, params }),
        // Tab goes round the lines of its open editor; from its last box, on to the next cell.
        suppressKeyboardEvent: (p) => {
          if (p.editing && p.event.key === 'Tab') {
            const editor = (p.event.target as Element | null)?.closest?.('.fd-grid-editor');
            const boxes = editor ? [...editor.querySelectorAll<HTMLElement>('input, button, select')].filter((b) => !b.closest('[hidden]') && !(b as HTMLButtonElement).disabled) : [];
            const at = boxes.indexOf(p.event.target as HTMLElement);
            const to = at + (p.event.shiftKey ? -1 : 1);
            if (at >= 0 && to >= 0 && to < boxes.length) return true;
          }
          return keys(p);
        },
      };
    }
    const drawn = node.cells?.[column]?.widget;
    if (drawn && DRAWN_IN_CELLS.has(drawn) && drawn !== 'badge') {
      const look = { widget: drawn, ...(node.cells?.[column]?.options ? { options: node.cells[column].options } : {}) };
      return {
        ...base,
        // Used in the cell itself: no editor opens over it.
        editable: false,
        cellRendererSelector: (p) =>
          kindOf(p.data) || p.node.rowPinned
            ? undefined
            : { component: DrawnRenderer, params: { cell, subfield: column, look, locked: (line: Line | undefined) => readonly || locked(sub) || !!ruleOf(line, column)?.readonly } },
        // Keys inside the widget are its own: its stars' arrows, its menu's.
        suppressKeyboardEvent: (p) => (p.event.target as Element | null)?.closest?.('.fd-grid-drawn') ? true : keys(p),
      };
    }
    if (node.cells?.[column]?.badge || drawn === 'badge') {
      return {
        ...base,
        cellRendererSelector: (p) => (kindOf(p.data) || p.node.rowPinned ? undefined : { component: BadgeRenderer, params: { toneOf: (line: Line | undefined) => ruleOf(line, column)?.tone ?? null } }),
      };
    }
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
      lockPosition: lineStart,
      suppressKeyboardEvent: keys,
    });
  }
  // A tick at the start of each item, choosing it for the table's buttons for chosen lines; the head's chooses every one.
  const picking: Picking = {
    label: (n) => fill(labels.chooseLine, { name: fill(labels.lineN, { n }) }),
    allLabel: labels.chooseAllLines,
    isChosen: (key) => chosen.has(key),
    choose(key, on) {
      if (on) chosen.add(key);
      else chosen.delete(key);
      showChosen(true);
    },
    chooseAll(on) {
      chosen.clear();
      if (on) for (const line of lines()) if (!kindOf(line)) chosen.add(line.key);
      showChosen(true);
    },
    head: (box) => {
      pickAll = box;
      showChosen(false);
    },
    readonly: () => readonly,
  };
  if (choosing) {
    columnDefs.unshift({
      colId: '__pick',
      headerName: '',
      headerComponent: PickAllHeader,
      headerComponentParams: { picking },
      width: 36,
      minWidth: 36,
      maxWidth: 36,
      cellClass: 'fd-grid-tools fd-grid-pick',
      resizable: false,
      sortable: false,
      suppressMovable: true,
      lockPosition: lineStart,
      cellRendererSelector: (p) => (p.node.rowPinned || kindOf(p.data) ? undefined : { component: PickRenderer, params: { picking } }),
      suppressKeyboardEvent: keys,
    });
  }
  // A copy of a line, its values too, right after it: never its saved id or its place in the order.
  const copyLine = (key: string) => {
    const all = lines();
    const at = all.findIndex((l) => l.key === key);
    if (readonly || at < 0) return;
    const values = { ...all[at].values };
    if (sequence) delete values[sequence];
    const made = form.addLine(name, values);
    if (sequence) form.moveLine(name, made, at + 1);
    else {
      const now = [...lines()];
      now.splice(at + 1, 0, ...now.splice(now.findIndex((l) => l.key === made), 1));
      form.setValue(name, now);
    }
  };
  if (node.options?.['copy'] === true) {
    columnDefs.push({
      colId: '__copy',
      headerName: '',
      width: 40,
      minWidth: 40,
      cellClass: 'fd-grid-tools',
      resizable: false,
      sortable: false,
      suppressMovable: true,
      lockPosition: lineEnd,
      cellRendererSelector: (p) => (p.node.rowPinned || kindOf(p.data) ? undefined : { component: CopyRenderer, params: { copy: copyLine, label: (n: number) => fill(labels.copy, { name: fill(labels.lineN, { n }) }) } }),
      suppressKeyboardEvent: keys,
    });
  }
  // AG Grid copies column definitions deeply, so the button calls through, never a copy.
  // With dialogs, a line can be opened to see and edit every one of its fields at once.
  // Its own record's page, by the table's model (lineOpens: "record"), or every one of its fields.
  const openLine = (line: Line) => (dialogs ? openLineDialog(form, name, node, line, dialogs, readonly) : undefined);
  if (node.rowButtons?.length) {
    columnDefs.push({
      colId: '__row_buttons',
      headerName: '',
      // An icon takes a small square; words, what they need.
      width: 16 + node.rowButtons.reduce((total, b) => total + (b.icon ? 28 : 16 + b.label.length * 7), 0),
      cellClass: 'fd-grid-tools',
      resizable: false,
      sortable: false,
      suppressMovable: true,
      lockPosition: lineEnd,
      cellRendererSelector: (p) =>
        p.node.rowPinned || kindOf(p.data)
          ? undefined
          : { component: RowButtonsRenderer, params: { buttons: node.rowButtons, stateOf: (key: string) => lineStates.get(key), press: (id: string, key: string) => form.runRowAction(node.id, id, key) } },
      suppressKeyboardEvent: keys,
    });
  }
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
      lockPosition: lineEnd,
      cellRendererSelector: (p) => (p.node.rowPinned || kindOf(p.data) ? undefined : { component: OpenRenderer, params: { open: openLine, label: labels.openLine } }),
      suppressKeyboardEvent: keys,
    });
  }
  const chooser: Chooser = { label: labels.chooseColumns, toggle: (button, fromKeyboard) => toggleChooser(button, fromKeyboard) };
  columnDefs.push({
    colId: '__delete',
    headerName: '',
    lockPosition: lineEnd,
    ...(optionalIds.length ? { headerComponent: ChooserHeader, headerComponentParams: { chooser } } : {}),
    width: 44,
    minWidth: 44,
    maxWidth: 44,
    cellClass: 'fd-grid-tools',
    resizable: false,
    sortable: false,
    suppressMovable: true,
    cellRendererSelector: (p) => (p.node.rowPinned ? undefined : { component: DeleteRenderer, params: { cell, deletable } }),
    suppressKeyboardEvent: keys,
  });

  // The buttons' words and the empty table's, as the plain table takes them from the node's options.
  const words = (key: string) => {
    const said = node.options?.[key];
    return typeof said === 'string' && said.trim() ? said : null;
  };
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
      enableRtl: rtl,
      rowData: lines(),
      pinnedBottomRowData: totals.length ? [totalsRow(lines())] : undefined,
      getRowId: (p) => p.data.key,
      getRowClass: (p) => {
        if (p.node.rowPinned) return 'fd-grid-totals';
        const kind = kindOf(p.data);
        return kind ? `fd-grid-${kind}` : undefined;
      },
      // A line's tone and bold, read again whenever its rules may have changed.
      rowClassRules: ruled
        ? {
            'fd-line-bold': (p) => !!(p.data && lineStates.get(p.data.key)?.bold),
            ...Object.fromEntries(TONES.map((tone) => [`fd-tone-${tone}`, (p: { data: Line | undefined }) => !!p.data && lineStates.get(p.data.key)?.tone === tone])),
          }
        : undefined,
      domLayout: 'autoHeight',
      // Lines have few columns: all of them are drawn.
      suppressColumnVirtualisation: true,
      readOnlyEdit: true,
      // An empty table says so in a short line where its rows would be, never a blank row.
      noRowsOverlayComponent: EmptyOverlay,
      noRowsOverlayComponentParams: { words: words('emptyLabel') ?? labels.noLines },
      singleClickEdit: true,
      // A page may ask for a whole line to open at once.
      editType: node.editMode === 'row' ? 'fullRow' : undefined,
      stopEditingWhenCellsLoseFocus: true,
      // Like a spreadsheet: Enter keeps what was typed and moves down.
      enterNavigatesVerticallyAfterEdit: true,
      // A line dragged by its handle moves among the others as it goes; where
      // it is let go, the form moves it too and numbers the lines again.
      rowDragManaged: !!sequence,
      // A line dragged is named by its words (a yes or no names nothing), else by its place.
      rowDragText: (p) => {
        const line = p.rowNode?.data;
        const column = titleColumn(columns.filter((c) => api.getColumn(c)?.isVisible() !== false));
        const value = line && (kindOf(line) && kinds ? line.values[kinds.text] : column ? line.values[column] : null);
        const text = value && typeof value === 'object' ? String((value as { label?: string }).label ?? '') : String(value ?? '');
        return text.trim() || placeName((p.rowNode?.rowIndex ?? 0) + 1);
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

  // Out of sight under display: none — a tab not shown, a field hidden by its condition — AG Grid measures
  // itself again every frame, for as long as it stays hidden. Taken off the page meanwhile, it rests;
  // put back the moment it has a box again, it draws itself to fit.
  const away = document.createComment('fd-grid-away');
  const View = document.defaultView;
  const sizes = View && 'ResizeObserver' in View
    ? new View.ResizeObserver(([entry]) => {
        const hidden = entry.contentRect.width === 0 && entry.contentRect.height === 0;
        if (hidden && host.isConnected) host.replaceWith(away);
        else if (!hidden && away.isConnected) away.replaceWith(host);
      })
    : null;
  sizes?.observe(element);

  // ---- columns a person arranged: kept, and brought back ----
  // A person's widths, order and choices are kept for the next visit. AG Grid
  // tells of each change a moment after it; bringing a layout back is told too,
  // and keeping it again changes nothing.
  // A person widens a column by dragging its edge; widths the grid sets itself (by its lines) are not theirs.
  api.addEventListener('columnResized', (event) => event.finished && event.source !== 'api' && remember(event.source));
  api.addEventListener('columnMoved', (event) => event.finished && remember(event.source));
  api.addEventListener('columnVisible', (event) => remember(event.source));
  /** Sizing the grid does by itself is not a choice to keep. */
  const automatic = new Set(['gridInitializing', 'flex', 'gridOptionsChanged', 'sizeColumnsToFit', 'autosizeColumns']);
  function remember(source: string) {
    // A grid taking itself apart also sends column events: they are not choices.
    if (automatic.has(source) || !preferences || api.isDestroyed()) return;
    // A column the record hides is kept as the person last had it: the rule's hiding is not their choice.
    const state = (api.getColumnState() ?? []).map(({ colId, width, flex, hide }) => ({ colId, width: width ?? null, flex: flex ?? null, hide: ruleHidden.has(colId) ? personHidden.has(colId) : !!hide }));
    preferences.set(columnsKey, state);
  }
  /** The columns the person hid with the chooser, or the page starts hidden. */
  const personHidden = new Set(optionalIds.filter((column) => optional[column] === 'hide'));
  const hiddenByPerson = (column: string) => personHidden.has(column);
  const saved = preferences?.get(columnsKey);
  /** The words' columns are sized by the lines once: when the first come, unless the person arranged the columns. */
  let sizedByLines = drawnFirst.length > 0 || Array.isArray(saved) || node.fit === 'content';
  function sizeByLines(lines: Line[]) {
    if (sizedByLines || !lines.length) return;
    sizedByLines = true;
    const state = columns.filter((column) => !node.cells?.[column]?.width).map((colId) => (fixedWidth(colId) ? { colId, width: roomOf(colId, lines), flex: null } : { colId, flex: roomOf(colId, lines) }));
    api.applyColumnState({ state });
  }
  if (Array.isArray(saved)) {
    const known = new Set(api.getColumns()?.map((c) => c.getColId()));
    const state = (saved as { colId?: unknown }[]).filter((s) => typeof s?.colId === 'string' && known.has(s.colId)) as ColumnState[];
    api.applyColumnState({ state, applyOrder: true });
    for (const s of state) {
      if (!optionalIds.includes(s.colId)) continue;
      if (s.hide) personHidden.add(s.colId);
      else personHidden.delete(s.colId);
    }
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
      // A column the record hides now is not the person's to show.
      ...optionalIds.filter((column) => !ruleHidden.has(column)).map((column) => {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.className = 'fd-checkbox';
        box.checked = api.getColumn(column)?.isVisible() ?? false;
        box.addEventListener('change', () => {
          if (box.checked) personHidden.delete(column);
          else personHidden.add(column);
          api.setColumnsVisible([column], box.checked);
        });
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
  addButton(words('addLabel') ?? labels.addLine, {}, 'line');
  if (kinds) {
    addButton(words('addSectionLabel') ?? labels.addSection, { [kinds.field]: kinds.section ?? 'section' }, 'section');
    addButton(words('addNoteLabel') ?? labels.addNote, { [kinds.field]: kinds.note ?? 'note' }, 'note');
  }
  // Buttons in the control row, beside the add buttons: the record's, shown by a condition on it (Flectra's <control>).
  const controls = (node.controlButtons ?? []).map((own) => {
    const button = ownButton(own, 'fd-button fd-button-link fd-lines-add fd-lines-control');
    button.addEventListener('click', () => void pressed(button, () => form.runAction(own.id)));
    adds.append(button);
    return { id: own.id, button };
  });
  /** What the cards were last drawn from: drawn again only when it changes. */
  let cardsDrawn = '';
  /** Each line as a card: its first column as its title, the rest by their labels, its tone, its buttons, ↗ and ×. */
  function drawCards() {
    if (!node.cards) return;
    const current = lines();
    const hidden = new Set(columns.filter((column) => ruleHidden.has(column) || api.getColumn(column)?.isVisible() === false));
    const shownColumns = columns.filter((column) => !hidden.has(column));
    const signature = JSON.stringify([current, [...lineStates], shownColumns, readonly, form.getState().values]);
    if (signature === cardsDrawn) return;
    cardsDrawn = signature;
    const parent = form.getState().values;
    const cards = current.map((line) => {
      const card = document.createElement('div');
      card.className = 'fd-line-card';
      card.dataset['line'] = line.key;
      const kind = kindOf(line);
      if (kind && kinds) {
        card.classList.add(`fd-line-card-${kind}`);
        card.textContent = String(line.values[kinds.text] ?? '');
        return card;
      }
      const state = lineStates.get(line.key);
      if (state?.tone) card.dataset['tone'] = state.tone;
      card.classList.toggle('fd-line-bold', !!state?.bold);
      const shownHere = shownColumns.filter((column) => !state?.cells[column]?.invisible);
      const first = titleColumn(shownHere);
      const rest = shownHere.filter((column) => column !== first);
      const text = (column: string) => {
        // A distribution says its accounts by their names, as its cell does, once they are found.
        const shares = distributions.get(column);
        if (!shares) return cellText(def.fields[column], line.values[column] as Value, line.values, locale, parent, node.cells?.[column]);
        const unknown = distributionIds(line.values[column] as Value).map(String).filter((id) => shares.nameOf(id) === undefined);
        if (unknown.length) shares.find(line, unknown);
        return distributionWords(line.values[column] as Value, locale, shares.nameOf);
      };
      const title = document.createElement(dialogs ? 'button' : 'div');
      title.className = 'fd-line-card-title';
      title.textContent = first ? text(first) || placeName(current.indexOf(line) + 1) : '';
      if (dialogs && title instanceof HTMLButtonElement) {
        title.type = 'button';
        title.addEventListener('click', () => void openLine(line));
      }
      const list = document.createElement('dl');
      for (const column of rest) {
        const dt = document.createElement('dt');
        dt.textContent = def.fields[column].label;
        const dd = document.createElement('dd');
        dd.textContent = text(column);
        const tone = state?.cells[column]?.tone;
        if (tone) dd.dataset['tone'] = tone;
        list.append(dt, dd);
      }
      const tools = document.createElement('div');
      tools.className = 'fd-line-card-tools';
      for (const own of node.rowButtons ?? []) {
        if (!state?.buttons[own.id]) continue;
        const button = ownButton(own, 'fd-button fd-button-link fd-line-button');
        button.dataset['rowButton'] = own.id;
        delete button.dataset['node'];
        button.addEventListener('click', () => void pressed(button, () => form.runRowAction(node.id, own.id, line.key)));
        tools.append(button);
      }
      if (!readonly && deletable(line.key)) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'fd-line-delete';
        remove.textContent = '×';
        remove.setAttribute('aria-label', labels.deleteLine);
        remove.addEventListener('click', () => form.removeLine(name, line.key));
        tools.append(remove);
      }
      card.append(title, list, tools);
      return card;
    });
    const items = current.filter((line) => !kindOf(line));
    const sums = totals.filter((column) => !hidden.has(column)).map((column) => {
      const sum = items.reduce((total, line) => total + Number(line.values[column] ?? 0), 0);
      return `${def.fields[column].label}: ${cellText(def.fields[column], sum, items[0]?.values ?? {}, locale, parent, node.cells?.[column])}`;
    });
    const total = sums.length ? Object.assign(document.createElement('div'), { className: 'fd-line-cards-total', textContent: sums.join(' · ') }) : null;
    cardList.replaceChildren(...cards, ...(total ? [total] : []));
  }

  /** The bar and the ticks, as the lines chosen are now; `redraw` draws the lines' ticks again. */
  function showChosen(redraw: boolean) {
    if (!choosing) return;
    const items = lines().filter((line) => !kindOf(line));
    for (const key of [...chosen]) if (!items.some((line) => line.key === key)) chosen.delete(key);
    bar.hidden = readonly || chosen.size === 0;
    chosenCount.textContent = fill(labels.linesChosen, { n: chosen.size });
    for (const { id, button } of chosenButtons) button.hidden = form.node(id).invisible;
    if (pickAll) {
      pickAll.checked = items.length > 0 && chosen.size === items.length;
      pickAll.indeterminate = chosen.size > 0 && chosen.size < items.length;
      pickAll.disabled = readonly || !items.length;
    }
    if (redraw) api.refreshCells({ columns: ['__pick'], force: true, suppressFlash: true });
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
      if (deletable(line.key)) form.removeLine(name, line.key);
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
        api.setGridOption('columnDefs', columnDefs.filter((c) => !(readonly && ['__delete', '__handle', '__copy', '__pick'].includes(c.colId as string))));
      }
      adds.hidden = readonly;
      for (const { id, button } of controls) button.hidden = form.node(id).invisible;
      const current = (state.value as Line[] | null) ?? [];
      if (current !== shown) {
        shown = current;
        api.setGridOption('rowData', current);
        fitHeight(current.length);
        if (totals.length) api.setGridOption('pinnedBottomRowData', [totalsRow(current)]);
        // Columns as wide as what they hold, once more as the lines change.
        if (node.fit === 'content') api.autoSizeAllColumns();
        sizeByLines(linesOf(current));
        // The ticks and copies name a line by where it is: it may have moved.
        if (choosing || node.options?.['copy'] === true) api.refreshCells({ columns: ['__pick', '__copy'], force: true, suppressFlash: true });
      }
      // Money in the record's currency: its cells written again once that currency changes.
      if (parentCurrencies.length) {
        const now = JSON.stringify(parentCurrencies.map((field) => state.values[field] ?? null));
        if (now !== currencyShown) {
          currencyShown = now;
          api.refreshCells({ force: true, suppressFlash: true });
        }
      }
      // The table's own rules as the form has them now: redrawn only when they changed.
      if (ruled) {
        const states = new Map(current.filter((line) => !kindOf(line)).map((line) => [line.key, form.lineState(node.id, line.key)] as const));
        const hidden = new Set(columns.filter((column) => form.columnHidden(node.id, column)));
        const before = JSON.stringify([[...lineStates], [...ruleHidden]]);
        lineStates = states;
        if (JSON.stringify([[...states], [...hidden]]) !== before) {
          const turned = columns.filter((column) => hidden.has(column) !== ruleHidden.has(column));
          ruleHidden = hidden;
          for (const column of turned) api.setColumnsVisible([column], !hidden.has(column) && !hiddenByPerson(column));
          api.refreshCells({ force: true, suppressFlash: true });
          api.redrawRows();
        }
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
      showChosen(false);
      drawCards();
      element.setAttribute('aria-invalid', String(state.invalid || found.length > 0));
    },
    destroy() {
      document.removeEventListener('mousedown', outside);
      sizes?.disconnect();
      api.destroy();
      apis.delete(element);
    },
  };
};

/** Pass these to the viewer (`widgets`) to show one2many nodes marked `"widget": "grid"` in the grid. */
export const gridWidgets: Record<string, WidgetFactory> = { 'one2many.grid': gridWidget };
