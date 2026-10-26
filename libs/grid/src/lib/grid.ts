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
import { fill, isRightToLeft, labelAt, lineKind, optionsList, type ButtonNode, type Choices, type SelectionOption, type Field, type Locale, type FieldNode, type Form, type Line, type LineField, type LineKinds, type LineState, type Value, type Values } from '@fieldia/core';
import { installGridStyles } from './styles';
import {
  afterPress,
  cellText,
  columnTotal,
  currencyOf,
  dateOrderOf,
  createWidget,
  distributionIds,
  distributionModel,
  distributionWords,
  DRAWN_IN_CELLS,
  drawIcon,
  itemNumber,
  keepsWhole,
  openLineDialog,
  kindTextField,
  lineColumn,
  lineForm,
  linesPart,
  type LinesPart,
  waitingTotal,
  WIDGET_LABELS,
  type WidgetDialogs,
  type Widget,
  type WidgetContext,
  type WidgetFactory,
  type WidgetLabels,
  fieldiaStyle,
  styleNonce,
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
  /** An editor of this line closed: true when Escape put the line back as it was. With a whole line open, several close at once. */
  finish(key: string): boolean;
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
  /**
   * Whether a person's press (a click, a tap) on this cell just started its edit: the press was on its box, so a link's
   * list drops open, as a click on the box opens it. Entered by the keys (Tab, Enter) or by the program, it stays closed.
   */
  pressed?(cell: Element): boolean;
  /** A block pasted in an open cell: spread from that cell on, as on a chosen cell (`pasteRows`). */
  pasteBlock?(rowIndex: number, column: string, text: string): void;
}

/**
 * Whether text pasted in an open cell is a block for the cells around it — rows, or cells side by side, as a
 * spreadsheet copies them — rather than one value for the box: by the lines part's reader where it has come, else by
 * its tabs and line breaks. A paragraph's box keeps several lines with no tabs, as the plain table's does.
 */
function pastedBlock(text: string, box: EventTarget | null): boolean {
  const readers = linesPart.loaded;
  if (box instanceof HTMLTextAreaElement && !text.includes('\t')) return false;
  if (readers) {
    const block = readers.blockOf(text);
    return block.length > 1 || block[0].length > 1;
  }
  const flat = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  return flat.includes('\t') || flat.includes('\n');
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

/**
 * A column's total under the lines, or a line's worked-out cell: its value, or, while it waits for a line — a cell
 * of it holding text that does not read — a dash with its words for a screen reader and on pointing at it.
 */
class TotalRenderer implements ICellRendererComp<Line> {
  private box!: HTMLElement;
  init(params: ICellRendererParams<Line> & { waits(): string | null }) {
    this.box = document.createElement('span');
    this.box.className = params.node.rowPinned ? 'fd-grid-total' : 'fd-grid-worked';
    this.refresh(params);
  }
  getGui() {
    return this.box;
  }
  refresh(params: ICellRendererParams<Line> & { waits(): string | null }) {
    const words = params.waits();
    if (words) {
      if (this.box.title !== words) waitingTotal(this.box, words);
      return true;
    }
    this.box.removeAttribute('title');
    delete this.box.dataset['waits'];
    this.box.textContent = params.valueFormatted ?? String(params.value ?? '');
    return true;
  }
}

/**
 * A choice's cell whose line's change took an option out of it: its value, and under it, seen as a plain table's cell
 * shows it, what was taken out ("A new email arrives is no longer offered, so it was taken out") — said aloud as well
 * by the grid's voice. Its row grows to show the words while they are said, and is as tall as any once they go.
 */
class TakenOutRenderer implements ICellRendererComp<Line> {
  private box!: HTMLElement;
  init(params: ICellRendererParams<Line> & { takenOut(): string | undefined }) {
    this.box = document.createElement('div');
    this.box.className = 'fd-grid-choice';
    this.refresh(params);
  }
  getGui() {
    return this.box;
  }
  refresh(params: ICellRendererParams<Line> & { takenOut(): string | undefined }) {
    const words = params.takenOut();
    const value = document.createElement('span');
    value.className = 'fd-grid-choice-value';
    value.textContent = params.valueFormatted ?? String(params.value ?? '');
    if (!words) {
      this.box.replaceChildren(value);
      return true;
    }
    const note = document.createElement('div');
    note.className = 'fd-warning fd-grid-taken-out';
    note.textContent = words;
    this.box.replaceChildren(...(value.textContent ? [value] : []), note);
    return true;
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
  /** A line's tick's words, naming it by its number as people count lines. */
  label(line: Line | undefined): string;
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
    this.box.setAttribute('aria-label', params.picking.label(params.data));
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
  private params!: ICellRendererParams<Line> & { copy(key: string): void; full(): boolean; label(line: Line | undefined): string };
  init(params: ICellRendererParams<Line> & { copy(key: string): void; full(): boolean; label(line: Line | undefined): string }) {
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
  refresh(params: ICellRendererParams<Line> & { copy(key: string): void; full(): boolean; label(line: Line | undefined): string }) {
    this.params = params;
    const label = params.label(params.data);
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
    // Hidden, never disabled, while the table holds its most lines.
    this.button.hidden = params.full();
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
  private unsubscribe = () => undefined as void;
  private params!: ICellEditorParams<Line> & { cell: CellContext; subfield: string };
  /** The line as it was when the edit began, for Escape to put back. */
  private before: Values = {};
  /** The line field this editor writes: the column's, or a section's or note's text. */
  private column = '';
  private def!: LineField;
  /** A section or note being edited, not an item. */
  private kind: 'section' | 'note' | null = null;
  private note: HTMLTextAreaElement | null = null;
  /** A tags box in a whole line open at once, which makes its line as tall as it needs. */
  private grows = false;
  /** The key that opened the editor, as a spreadsheet's does: typed into the box once it has the focus. */
  private startKey: string | null = null;

  init(params: ICellEditorParams<Line> & { cell: CellContext; subfield: string }) {
    this.params = params;
    this.startKey = params.eventKey ?? null;
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
    // A whole line open at once keeps its editors in the line (AG Grid has no popups then): a tags box makes the line as tall as it needs.
    if (cell.rowMode && def.type === 'many2many') {
      this.grows = true;
      this.box.classList.add('fd-grid-editor-grows');
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.fitLine()).observe(this.box);
    }
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
      // A link is searched by its name: wide enough to read one over a narrow column, on its row's line.
      else if (def.type === 'many2one' || def.type === 'reference') Object.assign(this.box.style, { minWidth: `${Math.max(width, 240)}px`, height: `${height}px` });
      else Object.assign(this.box.style, { width: `${width}px`, height: `${height}px` });
    }
    // The form never changes values in place, so holding them is enough.
    this.before = this.line()?.values ?? {};
    // A key the widget used itself (Enter picking from its list, Escape closing it) is not the grid's.
    this.box.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return _stopPropagationForAgGrid(event);
      if (event.key !== 'Escape') return;
      params.cell.cancel(key, this.before);
      // Closed now, its cell focused, not on AG Grid's next task: a key pressed straight after Escape lands on the
      // cell and opens its editor again with that key, never in this one as it goes.
      event.preventDefault();
      _stopPropagationForAgGrid(event);
      const { rowIndex, rowPinned } = params.node;
      const column = params.column.getColId();
      params.api.stopEditing(true);
      if (rowIndex !== null && !params.api.isDestroyed()) params.api.setFocusedCell(rowIndex, column, rowPinned);
    });
    // A block pasted in the open cell — a click opens one, and most people click before they paste — spreads across and
    // down from it, as on a chosen cell, what was typed in it so far let go as Escape lets it go; one value is the box's.
    this.box.addEventListener(
      'paste',
      (event) => {
        const text = event.clipboardData?.getData('text/plain') ?? '';
        const { rowIndex, rowPinned } = params.node;
        if (!cell.pasteBlock || !text || rowIndex === null || rowPinned || !pastedBlock(text, event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        const column = params.column.getColId();
        params.cell.cancel(key, this.before);
        params.api.stopEditing(true);
        if (!params.api.isDestroyed()) params.api.setFocusedCell(rowIndex, column, rowPinned);
        cell.pasteBlock(rowIndex, column, text);
      },
      true
    );
    // A day picked from a date's calendar is the whole answer: the cell keeps it and closes, as a
    // spreadsheet's does. A date typed stays open until Enter or Tab commits it. A date with a time
    // stays open for its time, and a whole line open at once stays open.
    if (def.type === 'date' && !cell.rowMode) this.box.addEventListener('fd-picked', () => params.stopEditing());
    // Like a spreadsheet, a cell reached from the keyboard has its text selected,
    // so typing replaces it; a click still puts the caret where it lands.
    let pointing = false;
    this.box.addEventListener('pointerdown', () => (pointing = true));
    this.box.addEventListener('focusin', (event) => {
      const input = event.target;
      if (!pointing && input instanceof HTMLInputElement && input.type !== 'checkbox' && input.type !== 'radio') selectFromStart(input);
      pointing = false;
    });
    // A value longer than its cell has room for takes the cell's padding too: measured in the frame the key is drawn in,
    // once the form has drawn what it changed — measured in the key's own event, it laid the whole page out once more
    // for every key (0.35.1).
    let fitting = 0;
    this.box.addEventListener('input', () => {
      const view = this.box.ownerDocument.defaultView;
      if (!view?.requestAnimationFrame) return this.fit();
      if (fitting) return;
      fitting = view.requestAnimationFrame(() => {
        fitting = 0;
        if (this.box.isConnected) this.fit();
      });
    });
    const show = () => {
      const line = this.line();
      // A cell the form found wrong stays marked while it is fixed.
      const invalid = !!cell.form.getState().errors[`${cell.field}.${key}.${column}`];
      this.box.classList.toggle('fd-grid-editor-invalid', invalid);
      this.widget.update({ value: line?.values[column], values: line?.values ?? {}, parent: cell.form.getState().values, readonly: false, required: def.required === true, invalid });
    };
    show();
    this.unsubscribe = cell.form.subscribe(show);
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
      if (event.key !== 'Enter' || event.shiftKey || event.altKey) return;
      // The popup's own handler hears the key as well as the cell's (whose suppressKeyboardEvent leaves Enter alone).
      _stopPropagationForAgGrid(event);
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      this.params.api.stopEditing();
    });
  }
  /**
   * A paragraph (a text field) is typed in a box of several lines over its
   * cell: Enter makes a new line there (the grid leaves it alone), and
   * Ctrl/Cmd+Enter finishes it, as a note's does.
   */
  private paragraph(area: HTMLTextAreaElement | null) {
    if (!area) return;
    area.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.altKey) return;
      // The popup's own handler hears the key as well as the cell's (whose suppressKeyboardEvent leaves Enter alone).
      _stopPropagationForAgGrid(event);
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      this.params.api.stopEditing();
    });
  }
  /** A value wider than the room inside the cell's padding takes the padding too, so more of it shows. */
  private fit() {
    const input = this.box.querySelector<HTMLInputElement>('input:not([type="checkbox"]):not([type="radio"])');
    if (!input) return;
    if (this.isPopup()) {
      // A link's name longer than its box widens the box to show it whole, as far as the window allows.
      const short = input.scrollWidth - input.clientWidth;
      if ((this.def.type === 'many2one' || this.def.type === 'reference') && short > 0) {
        const { left, width } = this.box.getBoundingClientRect();
        const room = this.box.ownerDocument.defaultView!.innerWidth - left - 16;
        this.box.style.minWidth = `${Math.round(Math.max(width, Math.min(width + short + 8, LINK_EDITOR_MOST, room)))}px`;
      }
      return;
    }
    if (input.scrollWidth > input.clientWidth) this.box.classList.add('fd-grid-editor-tight');
  }
  /** A line as tall as its tags box needs, never shorter than a line. */
  private fitLine() {
    const { node, api } = this.params;
    if (!this.box.isConnected || api.isDestroyed()) return;
    const height = Math.max(ROW_HEIGHT, this.box.scrollHeight + 2);
    if (height <= (node.rowHeight ?? 0)) return;
    node.setRowHeight(height);
    api.onRowHeightChanged();
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
    if (this.grows) this.fitLine();
    // With a whole line open, every editor is attached: only the one clicked takes the focus.
    if (this.params.cellStartedEdit === false) return;
    this.widget.focus();
    // Opened by a person's press on the cell, that press was on its box: a link's list drops open, as a click on a box
    // opens it. A focus alone — Tab or Enter into the cell — opens none.
    const combo = this.box.querySelector<HTMLElement>('[role="combobox"]');
    if (combo && document.activeElement === combo && !this.startKey && this.params.cell.pressed?.(this.params.eGridCell)) combo.click();
    if (this.note) {
      this.note.setSelectionRange(this.note.value.length, this.note.value.length);
      this.resize();
      return;
    }
    const input = this.box.querySelector('input');
    if (input && input.type !== 'checkbox' && document.activeElement === input) {
      selectFromStart(input);
      this.typeStartKey(input);
    }
  }
  /**
   * The key that opened the editor goes into its box, in place of the text, as
   * a spreadsheet's does: "57" is 57, "-3" is -3, "٣٤٥" is 345. It goes in as
   * typing does, through the box's own rules, so a letter in a number is
   * refused there with the hint and the value is kept. An IME's key (Process)
   * opens the box with its text chosen: the IME's words replace it.
   */
  private typeStartKey(input: HTMLInputElement) {
    const key = this.startKey;
    this.startKey = null;
    if (!key || [...key].length !== 1 || input.readOnly) return;
    // After the widget's own work on taking the focus (a number box writes its value plain), which waits a microtask too.
    queueMicrotask(() => {
      if (document.activeElement !== input) return;
      input.setSelectionRange(0, input.value.length);
      let typed: boolean;
      try {
        typed = document.execCommand('insertText', false, key);
      } catch {
        typed = false;
      }
      if (!typed) {
        input.setRangeText(key, 0, input.value.length, 'end');
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: key }));
      }
      this.fit();
    });
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
    // The box is left before it goes: its widget keeps what it read, or the text that does not read.
    const focused = this.box.ownerDocument.activeElement;
    if (focused instanceof HTMLElement && this.box.contains(focused)) focused.blur();
    this.unsubscribe();
    this.widget.destroy?.();
    const { node, api, cell, data } = this.params;
    // Its own problem — text that does not read, min, max — is said as the cell is left, unless Escape put the line back.
    // Left for a press elsewhere, once that press has ended: nothing moves under it (press.ts).
    if (!cell.finish(data.key) && !this.kind) {
      const path = `${cell.field}.${data.key}.${this.column}`;
      afterPress(this.box.ownerDocument, this.box, () => cell.form.boxLeft(path));
    }
    // The line closed: it gives back the height its tags box took.
    if (this.grows && !api.isDestroyed()) {
      node.setRowHeight(null);
      api.onRowHeightChanged();
    }
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
 * what reads.
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
/** How long a finger rests on a column's header before it lifts the column, in milliseconds, as in a list. */
const LONG_PRESS = 500;
/** How far a resting finger may wander before it is a swipe the browser scrolls with, in pixels. */
const WANDER = 10;

const EDITABLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'date', 'datetime', 'selection', 'many2one', 'many2many', 'reference']);

/** A badge's pill round its words, both sides: room its column keeps besides theirs. */
const BADGE_PADDING = 20;

/** The kinds of field that hold words: a line is named by the first of them. */
const WORDS = new Set(['char', 'text', 'html', 'many2one', 'reference']);
/** The kinds of a number: what a line works out from its others, and what a total adds. */
const NUMERIC = new Set(['integer', 'float', 'monetary']);

/** The kinds of field whose column is as wide as its values need, in characters, as Flectra's lists size them. */
/** The widest a link's editor grows to show a long name, in pixels. */
const LINK_EDITOR_MOST = 480;
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
  /** A finger resting on a column's header (below: a long press lifts the column), from its touch to its lifting. */
  let resting: { pointer: number; x: number; y: number; timer: number; cell: HTMLElement } | null = null;
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
  /** Text left in a cell that does not read, kept by the form by the cell's path. */
  const unreadAt = (line: Line | undefined, column: string) => (line && !kindOf(line) ? form.getState().unread?.[`${name}.${line.key}.${column}`] : undefined);
  /** A line's number as people count lines: items only, from 1 — sections and notes are not counted (0 for one). */
  const numberOf = (line: Line | undefined) => (line ? itemNumber(lines(), line.key, (one) => !kindOf(one)) : 0);
  /** A line's name by its number, for a tick, a copy button, a card: "Line 3". */
  const lineName = (line: Line | undefined) => fill(labels.lineN, { n: numberOf(line) });
  /**
   * A number no one types in — read-only, or worked out — on a line where a cell holds text that does not read: it
   * waits, as the totals do, rather than show what was worked out before that text was typed. Its words name the cell.
   */
  const cellWaits = (line: Line | undefined, column: string): string | null => {
    const sub = def.fields[column];
    if (!line || kindOf(line) || !sub || !NUMERIC.has(sub.type) || !locked(sub)) return null;
    const unread = Object.keys(def.fields).find((other) => other !== column && unreadAt(line, other));
    const small = (key: string) => labelAt(labels.cellWaits, key, form.page.lowerLabels, locale);
    return unread ? fill(labels.cellWaits, { column: small('column')(def.fields[unread].label), own: small('own')(sub.label) }) : null;
  };
  /** A column's total: numbers only, or the line it waits for (text that does not read, or no number, or a worked-out number that waits). */
  const totalOf = (current: Line[], column: string) => columnTotal(current, column, (line) => !kindOf(line), (line) => !!unreadAt(line, column) || !!cellWaits(line, column));
  /** The totals that wait for a line, by column: their words. */
  const totalWaits = new Map<string, string>();
  const totalsRow = (current: Line[]): Line => {
    const items = current.filter((line) => !kindOf(line));
    totalWaits.clear();
    const values = Object.fromEntries(
      totals.map((column) => {
        const total = totalOf(current, column);
        if ('waits' in total) totalWaits.set(column, fill(labels.totalWaits, { n: total.waits }));
        return [column, 'sum' in total ? total.sum : null];
      })
    );
    return { key: '__totals', values: { ...(items[0]?.values ?? {}), ...values } };
  };
  const element = document.createElement('div');
  /** The last press of a person's pointer on the grid: on which cell, and when. */
  let press: { cell: Element | null; at: number } | null = null;
  element.addEventListener('pointerdown', (event) => (press = { cell: event.target instanceof Element ? event.target.closest('.ag-cell') : null, at: performance.now() }), true);
  /** A block pasted in an open cell, once the grid can paste one (its editors hold this context as it was made). */
  let pasteInCell: (row: number, column: string, text: string) => void = () => undefined;
  const cell: CellContext = {
    pressed: (on) => !!press && press.cell === on && performance.now() - press.at < 1000,
    pasteBlock: (row, column, text) => pasteInCell(row, column, text),
    form,
    field: name,
    fieldId: node.id,
    defs: def.fields,
    labels,
    cancel: () => undefined,
    finish: () => false,
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
  // A press on a tick in a line — chosen, or a yes or no — is the tick's alone: the grid focusing its cell would
  // scroll a cell cut by the screen's edge into view, moving the tick from under the pointer, and the click would
  // land on the cell instead. (A button in a cell the grid leaves alone.) The tick still takes the focus and the click.
  for (const type of ['pointerdown', 'mousedown'] as const) {
    host.addEventListener(
      type,
      (event) => {
        if ((event.target as Element).closest?.('.ag-cell input[type="checkbox"]')) event.stopPropagation();
      },
      true
    );
  }
  // What is wrong on which line, once a save has been refused.
  const problems = document.createElement('div');
  problems.className = 'fd-error fd-grid-problems';
  problems.setAttribute('role', 'alert');
  problems.hidden = true;
  // What a block pasted on the cells did, said politely: how many cells took it, and which did not.
  const pasteNote = document.createElement('div');
  pasteNote.className = 'fd-help fd-grid-paste-note';
  pasteNote.setAttribute('role', 'status');
  pasteNote.setAttribute('aria-live', 'polite');
  pasteNote.hidden = true;
  // The box a paste on a chosen cell lands in where the browser sends none to the cell (Safari): see `catching` below.
  const catcher = document.createElement('textarea');
  catcher.className = 'fd-grid-paste-catcher';
  catcher.tabIndex = -1;
  catcher.setAttribute('aria-hidden', 'true');
  let destroyed = false;
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
  // Lines as cards too: the stylesheet shows them in the grid's place on a narrow form (`narrow`, as where the page says
  // nothing: a grid's cells cut their words at a phone's width), or always — where a line can be opened in its own form
  // to change it (`dialogs`); where nothing can open one, or the page says `never`, a grid at every width.
  const cardsShape = node.cards === 'never' || (!node.cards && !dialogs) ? null : (node.cards ?? 'narrow');
  const cardList = document.createElement('div');
  cardList.className = 'fd-line-cards';
  if (cardsShape) element.dataset['cards'] = cardsShape;
  element.append(...(choosing ? [bar] : []), ...(cardsShape ? [cardList] : []), host, problems, pasteNote, adds, catcher);
  /** Whether the lines show as cards now, in the grid's place. */
  const asCards = () => !!cardsShape && element.isConnected && (element.ownerDocument.defaultView?.getComputedStyle(cardList).display ?? 'none') !== 'none';

  let readonly = false;
  const lines = () => (form.getState().values[name] as Line[] | null) ?? [];
  /**
   * The most lines the table may have (`options.max`), as the plain table counts it: none unless a whole number. At
   * it, Add and a line's copy are hidden — never disabled — Enter or Tab at the last line's end adds none, and a
   * block pasted past it says what it left.
   */
  const most = (() => {
    const max = node.options?.['max'];
    return typeof max === 'number' && Number.isInteger(max) && max >= 0 ? max : Infinity;
  })();
  const full = () => lines().length >= most;
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
  /** A choice its line's change no longer offers — its connection's list, or its condition — taken out, until its value changes again: its words. */
  const clearedAt = (line: Line | undefined, column: string) => (line ? form.getState().takenOut?.[`${name}.${line.key}.${column}`] : undefined);
  /** Every line problem, in the order the lines and columns are shown. */
  const lineProblems = () => {
    // None said under any of the lines: none looked for, cell by cell (0.35.1).
    const errors = form.getState().errors;
    let any = false;
    for (const path in errors) if (path.startsWith(`${name}.`)) {
      any = true;
      break;
    }
    if (!any) return [];
    const shown = api.getAllDisplayedColumns().map((c) => c.getColId()).filter((id) => !isTool(id));
    const found: { index: number; number: number; column: string; message: string }[] = [];
    lines().forEach((line, index) => {
      for (const column of shown) {
        const message = problemAt(line, column, api);
        // Its row (to open it), and its number as people count lines: a section above it is no line.
        if (message) found.push({ index, number: numberOf(line), column, message });
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
    if (!before) {
      fresh.delete(key);
      return false;
    }
    cancelling.delete(key);
    // Put back as it was, text that did not read goes with what was typed.
    for (const column of Object.keys(def.fields)) form.setUnread(`${name}.${key}.${column}`, null);
    // A line added a moment ago is taken back, unless the table keeps it: then it stays, as it was begun.
    if (fresh.delete(key)) {
      if (deletable(key)) form.removeLine(name, key);
      return true;
    }
    const current = lines();
    if (current.some((l) => l.key === key)) form.setValue(name, current.map((l) => (l.key === key ? { ...l, values: before } : l)));
    return true;
  };
  /** Add a line (or a section or note) at the end and start editing its first cell. */
  const addAndEdit = (values: Values = {}) => {
    const key = form.addLine(name, values);
    fresh.add(key);
    // As cards, the new line opens in its own form, as a card is changed; let go there, it goes again.
    if (asCards()) return void openCard(key);
    const index = lines().findIndex((l) => l.key === key);
    const column = kindOf(lines()[index]) ? spanStart(api)?.getColId() : firstEditable();
    if (index < 0 || !column) return;
    api.ensureIndexVisible(index);
    api.setFocusedCell(index, column);
    api.startEditingCell({ rowIndex: index, colKey: column });
  };
  /** A paragraph (a text field) of an item, edited in its box of several lines over the cell. */
  const paragraphCell = (line: Line | undefined, column: string) => !cell.rowMode && !kindOf(line) && def.fields[column]?.type === 'text';
  /**
   * Keys the grid must leave alone, and the two that run off the end of the
   * table while editing: Enter on the last line and Tab on its last editable
   * cell both start a new line.
   */
  const keys = ({ event, editing, node, column }: SuppressKeyboardEventParams<Line>) => {
    if (event.defaultPrevented) return true;
    // A key an IME is composing with — the Enter that takes its word — is the IME's: the cell stays open, its box keeps it.
    if (editing && (event.isComposing || event.keyCode === 229)) return true;
    // Alt+Up/Down moves the line (below), it does not move the focus.
    if (!editing && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return true;
    // In a note, or a paragraph opened over its cell, Enter is a new line (Ctrl/Cmd+Enter finishes it).
    if (editing && event.key === 'Enter' && !event.ctrlKey && !event.metaKey && (kindOf(node.data) === 'note' || paragraphCell(node.data, column.getColId()))) return true;
    if (!editing || event.type !== 'keydown' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
    // At its most lines, the last line's end adds none: the key does what it does on any other line.
    if (node.rowIndex !== lines().length - 1 || full()) return false;
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
    let longest = sub.type === 'boolean' ? 0 : lines.reduce((most, line) => Math.max(most, cellText(lineColumn(form, name, line.key, column, sub), line.values[column] as Value, line.values, locale, form.getState().values, node.cells?.[column]).length), 0);
    // A badge may turn to any of its choices: room for the longest, though no line holds it yet.
    if (badged(column) && sub.type === 'selection') longest = sub.options.reduce((most, option) => Math.max(most, option.label.length), longest);
    // A long label over short numbers wraps onto a second line rather than widen its column; only its longest word sets a floor.
    return Math.round(Math.min(Math.max(longest, least, labelWord(column)), 40) * 7.6 + 40) + (badged(column) ? BADGE_PADDING : 0);
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

  /** The columns whose choices a line's change may take out of it: its list's, or its options' conditions. */
  const changingColumns = columns.filter((column) => { const sub = def.fields[column]; return sub.type === 'selection' && (!!optionsList(sub.optionsFrom) || (sub.options as SelectionOption[]).some((option) => option.invisible !== undefined && option.invisible !== false)); });
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
      // Not under a finger resting on it: its long press lifts the column, whose ghost says its name.
      headerTooltip: () => (resting ? undefined : sub.label),
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
      valueFormatter: (p) => {
        if (kindOf(p.data) || (p.node?.rowPinned && !totals.includes(column))) return String(p.value ?? '');
        // A total that waits for a line: a dash, its words said by its renderer.
        if (p.node?.rowPinned && totalWaits.has(column)) return '—';
        // Hidden by its line, the cell stays, blank, so the column lines up.
        if (ruleOf(p.data, column)?.invisible) return '';
        // Text left that does not read shows as it was typed, marked, never as a number it is not.
        const unread = p.node?.rowPinned ? undefined : unreadAt(p.data, column);
        if (unread) return unread.text;
        // A number worked out from it waits for it: a dash, its words said by its renderer.
        if (!p.node?.rowPinned && cellWaits(p.data, column)) return '—';
        // A choice from the app's list by the label its line's choices give it.
        return cellText(p.data && !p.node?.rowPinned ? lineColumn(form, name, p.data.key, column, sub) : sub, p.value as Value, p.data?.values ?? {}, locale, form.getState().values, node.cells?.[column]);
      },
      type: numeric ? 'rightAligned' : undefined,
      // A section or note runs across every column but the delete button.
      colSpan: (p) => (kindOf(p.data) && spans(p.api) ? spanWidth(p.api) : 1),
      // Rows are measured, so a note of several lines shows all of them.
      autoHeight: !!kinds,
      cellClassRules: {
        'fd-grid-kind-text': (p) => !!kindOf(p.data),
        // A value a person typed, in its own direction: a text cell's, a section's or a note's words.
        'fd-grid-words': (p) => !p.node.rowPinned && (!!kindOf(p.data) || sub.type === 'char' || sub.type === 'text'),
        'fd-grid-invalid': (p) => !p.node.rowPinned && (!!problemAt(p.data, column, p.api) || !!unreadAt(p.data, column)),
        // Shown as it was typed, in the order it was typed, as its box shows it: "12 34" never "34 12" on a right-to-left page.
        'fd-grid-unread': (p) => !p.node.rowPinned && !!unreadAt(p.data, column),
        'fd-cell-bold': (p) => !!ruleOf(p.data, column)?.bold,
        ...Object.fromEntries(TONES.map((tone) => [`fd-tone-${tone}`, (p: { data: Line | undefined }) => ruleOf(p.data, column)?.tone === tone])),
      },
      tooltipValueGetter: (p) => (p.node?.rowPinned ? undefined : (problemAt(p.data, column, p.api) ?? unreadAt(p.data, column)?.message ?? clearedAt(p.data, column))),
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
              cardsKept.clear();
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
    if (changingColumns.includes(column)) {
      return {
        ...base,
        // What a line's change took out of it is seen under its value, its row as tall as the words need.
        cellRendererSelector: (p) => (kindOf(p.data) || p.node.rowPinned ? undefined : { component: TakenOutRenderer, params: { takenOut: () => clearedAt(p.data, column) } }),
        autoHeight: true,
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
  // A total that waits for a line says so to a screen reader too, and on pointing at it: never NaN, never a confident 0.00.
  for (const colDef of columnDefs) {
    const column = colDef.colId as string;
    const own = colDef.cellRendererSelector;
    // A number worked out on a line that waits says why too: its line's cell that does not read.
    const worked = NUMERIC.has(def.fields[column]?.type) && locked(def.fields[column]) && !own;
    if (!totals.includes(column) && !worked) continue;
    colDef.cellRendererSelector = (p) =>
      p.node.rowPinned
        ? totals.includes(column)
          ? { component: TotalRenderer, params: { waits: () => totalWaits.get(column) ?? null } }
          : own?.(p)
        : worked && !kindOf(p.data)
          ? { component: TotalRenderer, params: { waits: () => cellWaits(p.data, column) } }
          : own?.(p);
  }
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
      // Held in sight at the line's start, however far the lines scroll sideways.
      pinned: lineStart,
      suppressKeyboardEvent: keys,
    });
  }
  // A tick at the start of each item, choosing it for the table's buttons for chosen lines; the head's chooses every one.
  const picking: Picking = {
    label: (line) => fill(labels.chooseLine, { name: lineName(line) }),
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
      // Held in sight at the line's start, however far the lines scroll sideways.
      pinned: lineStart,
      cellRendererSelector: (p) => (p.node.rowPinned || kindOf(p.data) ? undefined : { component: PickRenderer, params: { picking } }),
      suppressKeyboardEvent: keys,
    });
  }
  // A copy of a line, its values too, right after it: never its saved id or its place in the order.
  const copyLine = (key: string) => {
    const all = lines();
    const at = all.findIndex((l) => l.key === key);
    if (readonly || at < 0 || full()) return;
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
      pinned: lineEnd,
      cellRendererSelector: (p) => (p.node.rowPinned || kindOf(p.data) ? undefined : { component: CopyRenderer, params: { copy: copyLine, full, label: (line: Line | undefined) => fill(labels.copy, { name: lineName(line) }) } }),
      suppressKeyboardEvent: keys,
    });
  }
  // AG Grid copies column definitions deeply, so the button calls through, never a copy.
  // With dialogs, a line can be opened to see and edit every one of its fields at once.
  // Its own record's page, by the table's model (lineOpens: "record"), or every one of its fields.
  const openLine = (line: Line) => (dialogs ? openLineDialog(form, name, node, line, dialogs, readonly) : undefined);
  /**
   * A card's line in its own form: an item's every field, a section's or a note's words alone. A line the grid just
   * added that comes back as it was added — let go, nothing typed — goes again, as Escape takes one from the grid.
   */
  async function openCard(key: string) {
    const line = lines().find((one) => one.key === key);
    if (!line || !dialogs) return;
    const before = JSON.stringify(line.values);
    if (kindOf(line) && kinds) {
      const text = def.fields[kinds.text] as Field;
      const values = await dialogs.editValues({ title: def.label, fields: { [kinds.text]: text }, values: { [kinds.text]: line.values[kinds.text] ?? null }, readonly, ...(form.page.lowerLabels === undefined ? {} : { lowerLabels: form.page.lowerLabels }) });
      if (values && lines().some((one) => one.key === key)) form.updateLine(name, key, kinds.text, values[kinds.text] ?? null);
    } else await openLine(line);
    const now = lines().find((one) => one.key === key);
    if (fresh.has(key) && now && JSON.stringify(now.values) === before) form.removeLine(name, key);
    fresh.delete(key);
  }
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
      pinned: lineEnd,
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
      pinned: lineEnd,
      cellRendererSelector: (p) => (p.node.rowPinned || kindOf(p.data) ? undefined : { component: OpenRenderer, params: { open: openLine, label: labels.openLine } }),
      suppressKeyboardEvent: keys,
    });
  }
  const chooser: Chooser = { label: labels.chooseColumns, toggle: (button, fromKeyboard) => toggleChooser(button, fromKeyboard) };
  columnDefs.push({
    colId: '__delete',
    headerName: '',
    lockPosition: lineEnd,
    // A line's buttons held in sight at its end, however far the lines scroll sideways.
    pinned: lineEnd,
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
      // AG Grid's own sheets with the page's nonce, under a policy with no 'unsafe-inline' (style-nonce.ts).
      styleNonce: styleNonce(document),
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
      // The theme's heights as the grid's own too: a grid drawn out of sight (a tab not opened, a page drawn for paper)
      // cannot read them from its theme until shown, and read then, inside its observer of their size, they changed its
      // rows' and header's heights as it was told its own — a loop the browser reports (WebKit as a page error:
      // "ResizeObserver loop completed with undelivered notifications").
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
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
        return text.trim() || placeName(numberOf(line) || (p.rowNode?.rowIndex ?? 0) + 1);
      },
      onRowDragEnd: (event) => {
        const key = event.node.data?.key;
        if (key && event.node.rowIndex !== null) form.moveLine(name, key, event.node.rowIndex);
      },
      animateRows: false,
      suppressMovableColumns: false,
      // A column dragged out of the grid stays: AG Grid would hide it, and one the page lets nobody hide would be gone.
      suppressDragLeaveHidesColumns: true,
      defaultColDef: { sortable: false, resizable: true },
    },
    { modules: [AllCommunityModule] }
  );
  apis.set(element, api);

  // Out of sight under display: none — a tab not shown, a field hidden by its condition — AG Grid measures
  // itself again every frame, for as long as it stays hidden. Taken off the page meanwhile, it rests;
  // put back once it has a box again, it draws itself to fit — in the next frame, never inside the observer's own
  // call: put back there, it grows the box observed while its size is told, a loop the browser reports (WebKit as a
  // page error: "ResizeObserver loop completed with undelivered notifications", as every tab is shown for paper).
  const away = document.createComment('fd-grid-away');
  const View = document.defaultView;
  let back = 0;
  const putBack = () => {
    back = 0;
    if (away.isConnected && element.getClientRects().length) away.replaceWith(host);
  };
  const sizes = View && 'ResizeObserver' in View
    ? new View.ResizeObserver(([entry]) => {
        const hidden = entry.contentRect.width === 0 && entry.contentRect.height === 0;
        if (hidden && host.isConnected) host.replaceWith(away);
        else if (!hidden && away.isConnected && !back) back = View.requestAnimationFrame(putBack);
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
  /** A drag's columns being put back as they were (below): no choice to keep. */
  let puttingBack = false;
  function remember(source: string) {
    // A grid taking itself apart also sends column events: they are not choices; nor a drag put back.
    if (automatic.has(source) || !preferences || api.isDestroyed() || puttingBack) return;
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

  // ---- a column dragged by its header, as a list's (the columns part in @fieldia/viewer) ----
  // AG Grid moves it as it is dragged, its ghost under the pointer, the others sliding aside, the column in the place it
  // takes marked. As in a list: Escape puts it back (AG Grid stops the drag where it had slid it), a drag out of the
  // grid never hides it (AG Grid would: a column the page does not let people hide would be gone for good), a finger
  // lifts it by resting on its header a moment — a swipe there scrolls the page, a tap is a tap (AG Grid moved it at
  // the first touch, its header taking every swipe) — and its new place is said to a screen reader.
  /** The columns as a header's drag began: put back when Escape ends it; to say where the column went. */
  let dragFrom: ColumnState[] | null = null;
  const headerOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('.ag-header-cell[col-id]') : null);
  /** A line's own column, never the tools' at its ends (a tick, a handle, its buttons). */
  const ownColumn = (id: string | null | undefined): id is string => !!id && !isTool(id);
  /** The line's own columns in the order a person sees them. */
  const seenColumns = () => (api.getAllDisplayedColumns() ?? []).map((column) => column.getColId()).filter(ownColumn);
  const voice = document.createElement('div');
  voice.className = 'fd-sr-only';
  voice.setAttribute('role', 'status');
  voice.setAttribute('aria-live', 'polite');
  element.append(voice);
  /** The column dragged, tinted down the whole grid with a line at its start, as a list's: AG Grid marks its header alone. */
  const lifted = fieldiaStyle(document, '');
  element.append(lifted);
  const tint = (column: string | null) => {
    lifted.textContent = column ? `#${CSS.escape(id)} .ag-cell[col-id="${CSS.escape(column)}"] { background: var(--fd-accent-soft); box-shadow: inset ${rtl ? -2 : 2}px 0 0 var(--fd-accent); }` : '';
  };
  api.addEventListener('dragStarted', (event) => {
    const column = headerOf(event.target)?.getAttribute('col-id');
    dragFrom = ownColumn(column) ? (api.getColumnState() ?? null) : null;
    tint(dragFrom && column ? column : null);
  });
  api.addEventListener('dragCancelled', () => {
    const from = dragFrom;
    dragFrom = null;
    tint(null);
    if (!from || api.isDestroyed()) return;
    puttingBack = true;
    api.applyColumnState({ state: from, applyOrder: true });
    // AG Grid tells of the columns put back a moment later, in its batch of events already on its way: none is kept.
    window.setTimeout(() => (puttingBack = false), 0);
  });
  api.addEventListener('dragStopped', (event) => {
    const from = dragFrom;
    dragFrom = null;
    tint(null);
    const id = headerOf(event.target)?.getAttribute('col-id');
    if (!from || !ownColumn(id) || api.isDestroyed()) return;
    const before = from.filter((one) => !one.hide).map((one) => one.colId).filter(ownColumn);
    const now = seenColumns();
    if (before.join() === now.join()) return;
    // Let go out of the grid, AG Grid tells of no move: the column stays where it was seen, so it is kept there.
    remember('uiColumnMoved');
    // Its label small inside the sentence where the page asks (`lowerLabels`), as every sentence naming a field.
    if (before.indexOf(id) !== now.indexOf(id)) voice.textContent = fill(labels.movedTo, { label: labelAt(labels.movedTo, 'label', form.page.lowerLabels, locale)(def.fields[id]?.label ?? id), n: now.indexOf(id) + 1, total: now.length });
  });
  // A finger on a header: AG Grid's press waits until it has rested there a moment, and is handed on then.
  const handedOn = new WeakSet<Event>();
  const stopResting = () => {
    if (!resting) return;
    window.clearTimeout(resting.timer);
    resting.cell.removeAttribute('data-lifted');
    resting = null;
    host.removeEventListener('touchmove', holdPage, true);
  };
  /** Once lifted, the finger moves the column, not the page. */
  const holdPage = (event: TouchEvent) => {
    if (resting?.cell.hasAttribute('data-lifted') && event.cancelable) event.preventDefault();
  };
  /** A header's own column pressed by a finger, not on its edge (which sizes it). */
  const fingerOnHeader = (event: Event) => {
    const cell = headerOf(event.target);
    return cell && ownColumn(cell.getAttribute('col-id')) && !(event.target as Element).closest('.ag-header-cell-resize') ? cell : null;
  };
  host.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch' || handedOn.has(event)) return;
      const cell = fingerOnHeader(event);
      if (!cell) return;
      event.stopPropagation();
      stopResting();
      const { pointerId, clientX, clientY } = event;
      const target = event.target as Element;
      const timer = window.setTimeout(() => {
        if (!resting || resting.pointer !== pointerId) return;
        cell.setAttribute('data-lifted', '');
        const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, pointerId, pointerType: 'touch', isPrimary: true, clientX: resting.x, clientY: resting.y, button: 0, buttons: 1 });
        handedOn.add(down);
        target.dispatchEvent(down);
      }, LONG_PRESS);
      resting = { pointer: pointerId, x: clientX, y: clientY, timer, cell };
      host.addEventListener('touchmove', holdPage, { capture: true, passive: false });
    },
    true
  );
  // AG Grid's touch path waits with its pointer's.
  host.addEventListener('touchstart', (event) => fingerOnHeader(event) && event.stopPropagation(), { capture: true, passive: true });
  host.addEventListener(
    'pointermove',
    (event) => {
      // A finger that wanders before it has rested is a swipe: the browser scrolls.
      if (resting && event.pointerId === resting.pointer && !resting.cell.hasAttribute('data-lifted') && Math.hypot(event.clientX - resting.x, event.clientY - resting.y) > WANDER) stopResting();
    },
    true
  );
  for (const type of ['pointerup', 'pointercancel'] as const) host.addEventListener(type, (event) => resting && event.pointerId === resting.pointer && stopResting(), true);
  // A long press is the drag's, never the browser's menu over the header.
  host.addEventListener('contextmenu', (event) => resting && event.preventDefault(), true);

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
  /** A cell's words, as its cell shows them: what was typed and does not read, a dash while it waits, a distribution's accounts by name. */
  function cellWords(line: Line, column: string, parent: Values): string {
    // A distribution says its accounts by their names, as its cell does, once they are found.
    const shares = distributions.get(column);
    if (!shares) return unreadAt(line, column)?.text ?? (cellWaits(line, column) ? '—' : cellText(lineColumn(form, name, line.key, column, def.fields[column]), line.values[column] as Value, line.values, locale, parent, node.cells?.[column]));
    const unknown = distributionIds(line.values[column] as Value).map(String).filter((id) => shares.nameOf(id) === undefined);
    if (unknown.length) shares.find(line, unknown);
    return distributionWords(line.values[column] as Value, locale, shares.nameOf);
  }

  /**
   * The lines on paper: a plain table of every line, as the grid shows them — its columns shown, a section or a note
   * across the row, the totals under them — in the grid's place while the page prints (the stylesheet's @media print).
   * A grid draws only the lines and columns it has room for on screen, and keeps the screen's widths: paper takes
   * every one, as wide as the sheet. Made as printing begins, gone once it is done.
   */
  let paper: HTMLTableElement | null = null;
  const NUMBERS = new Set(['integer', 'float', 'monetary']);
  function paperTable(): HTMLTableElement {
    const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', end = false, whole = false) => {
      const cell = document.createElement(tag);
      cell.textContent = text;
      if (end) cell.className = 'fd-num';
      // A day or a phone number on one line too, as a number is.
      if (whole) cell.classList.add('fd-whole');
      return cell;
    };
    const parent = form.getState().values;
    // In the order the person sees them — a header dragged, or the order kept for them — as the screen shows them.
    const seen = seenColumns();
    const at = (column: string) => (seen.includes(column) ? seen.indexOf(column) : seen.length + columns.indexOf(column));
    const shown = columns.filter((column) => !ruleHidden.has(column) && api.getColumn(column)?.isVisible() !== false).sort((a, b) => at(a) - at(b));
    const atEnd = (column: string) => NUMBERS.has(def.fields[column].type);
    const table = document.createElement('table');
    table.className = 'fd-print-table';
    const head = document.createElement('tr');
    head.append(...shown.map((column) => make('th', def.fields[column].label, atEnd(column))));
    table.createTHead().append(head);
    const body = table.createTBody();
    for (const line of lines()) {
      const row = body.insertRow();
      const kind = kindOf(line);
      if (kind && kinds) {
        row.className = `fd-line-${kind}`;
        const cell = make('td', String(line.values[kinds.text] ?? ''));
        cell.colSpan = shown.length;
        row.append(cell);
        continue;
      }
      const state = lineStates.get(line.key);
      row.append(...shown.map((column) => make('td', state?.cells[column]?.invisible ? '' : cellWords(line, column, parent), atEnd(column), keepsWhole(def.fields[column].type, node.cells?.[column]?.widget))));
    }
    const current = lines();
    const items = current.filter((line) => !kindOf(line));
    const sums = totals.filter((column) => shown.includes(column));
    if (sums.length) {
      const foot = table.createTFoot().insertRow();
      foot.append(
        ...shown.map((column) => {
          if (!sums.includes(column)) return make('td');
          const total = totalOf(current, column);
          return make('td', 'waits' in total ? fill(labels.totalWaits, { n: total.waits }) : cellText(def.fields[column], total.sum, items[0]?.values ?? {}, locale, parent, node.cells?.[column]), atEnd(column));
        })
      );
    }
    return table;
  }
  const printing = () => {
    paper?.remove();
    paper = paperTable();
    element.append(paper);
    element.setAttribute('data-fd-printing', '');
  };
  const printed = () => {
    paper?.remove();
    paper = null;
    element.removeAttribute('data-fd-printing');
  };
  const view = document.defaultView;
  view?.addEventListener('beforeprint', printing);
  view?.addEventListener('afterprint', printed);
  // Drawn after printing began — a tab never opened, drawn for paper — the viewer tells it (`fd-paper`): its paper table
  // then, never the grid itself laid out across a sheet.
  element.setAttribute('data-fd-paper', '');
  element.addEventListener('fd-paper', () => !paper && printing());

  /**
   * Each line's card as last drawn, by its key, and what it was drawn from — the line, its rules' state, its number, the
   * text left unread in it, what its change took out of it and the choices its cells show — drawn again only once one
   * of them changed (0.35.1): a key in the record's header draws no card, a key in a line its own. `cardsSetting`, what
   * every card is drawn by — the columns shown, read-only, the record's currency its money is in — draws them all again.
   */
  const cardsKept = new Map<string, { inputs: unknown[]; card: HTMLElement }>();
  let cardsSetting = '';
  /** The cards' foot as last drawn: its totals' words, or that there are no lines. */
  let cardsFoot = '';
  /** What of the form a line's card shows besides the line itself, by its paths (`lines.key.column`): their words, joined. */
  const ownOf = (held: Readonly<Record<string, unknown>> | undefined, key: string) => {
    if (!held) return '';
    const at = `${name}.${key}.`;
    let out = '';
    for (const path in held) if (path.startsWith(at)) out += `${path}\u0000${JSON.stringify(held[path])}\u0001`;
    return out;
  };
  /** Each line as a card: its first column as its title, the rest by their labels, its tone, its buttons, ↗ and ×. */
  function drawCards() {
    if (!cardsShape) return;
    const current = lines();
    const hidden = new Set(columns.filter((column) => ruleHidden.has(column) || api.getColumn(column)?.isVisible() === false));
    const shownColumns = columns.filter((column) => !hidden.has(column));
    const parent = form.getState().values;
    const setting = JSON.stringify([shownColumns, readonly, parentCurrencies.map((field) => parent[field] ?? null)]);
    if (setting !== cardsSetting) {
      cardsSetting = setting;
      cardsKept.clear();
    }
    const { unread, takenOut } = form.getState();
    let n = 0;
    let drawn = false;
    const cards = current.map((line) => {
      const number = kindOf(line) ? 0 : ++n;
      const inputs = [line, lineStates.get(line.key), number, ownOf(unread, line.key), ownOf(takenOut, line.key), ...listedColumns.map((column) => choicesShown.get(`${name}.${line.key}.${column}`))];
      const kept = cardsKept.get(line.key);
      if (kept && kept.inputs.length === inputs.length && kept.inputs.every((input, at) => input === inputs[at])) return kept.card;
      drawn = true;
      const card = drawCard(line, shownColumns, parent);
      cardsKept.set(line.key, { inputs, card });
      return card;
    });
    for (const key of [...cardsKept.keys()]) if (!current.some((line) => line.key === key)) cardsKept.delete(key);
    const items = current.filter((line) => !kindOf(line));
    const sums = totals.filter((column) => !hidden.has(column)).map((column) => {
      const total = totalOf(current, column);
      const said = 'waits' in total ? fill(labels.totalWaits, { n: total.waits }) : cellText(def.fields[column], total.sum, items[0]?.values ?? {}, locale, parent, node.cells?.[column]);
      return `${def.fields[column].label}: ${said}`;
    });
    const foot = current.length ? sums.join(' · ') : `\u0000${words('emptyLabel') ?? labels.noLines}`;
    const before = [...cardList.children].filter((child) => child.classList.contains('fd-line-card'));
    // The same cards in the same order, and the same foot: nothing written; the same lines, each card drawn again put in
    // its own place, the rest left where they are.
    const inPlace = before.length === cards.length && !!cards.length && before.every((card, at) => card === cards[at] || (card as HTMLElement).dataset['line'] === cards[at].dataset['line']);
    const shownTotal = cardList.querySelector<HTMLElement>(':scope > .fd-line-cards-total');
    if (inPlace && (foot === cardsFoot || (!!shownTotal && sums.length > 0))) {
      if (drawn) before.forEach((card, at) => card !== cards[at] && card.replaceWith(cards[at]));
      cardsFoot = foot;
      if (shownTotal && shownTotal.textContent !== sums.join(' · ')) shownTotal.textContent = sums.join(' · ');
      return;
    }
    cardsFoot = foot;
    const total = sums.length ? Object.assign(document.createElement('div'), { className: 'fd-line-cards-total', textContent: sums.join(' · ') }) : null;
    // No lines yet: said in the cards' place, as the grid says it in its body.
    const none = current.length ? null : Object.assign(document.createElement('p'), { className: 'fd-help fd-line-cards-empty', textContent: words('emptyLabel') ?? labels.noLines });
    cardList.replaceChildren(...(none ? [none] : cards), ...(total && !none ? [total] : []));
  }

  /** A line's card, drawn: its first column as its title, the rest by their labels, its tone, its buttons, ↗ and ×. */
  function drawCard(line: Line, shownColumns: readonly string[], parent: Values): HTMLElement {
    const card = document.createElement('div');
    card.className = 'fd-line-card';
    card.dataset['line'] = line.key;
    const kind = kindOf(line);
    if (kind && kinds) {
      card.classList.add(`fd-line-card-${kind}`);
      // A section's or a note's words, changed in a form of their own, as its cell is in the grid.
      const words = String(line.values[kinds.text] ?? '');
      if (!dialogs || readonly) card.append(Object.assign(document.createElement('div'), { className: 'fd-grid-words', textContent: words }));
      else {
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'fd-line-card-title fd-grid-words';
        open.textContent = words || (def.fields[kinds.text]?.label ?? '');
        open.addEventListener('click', () => void openCard(line.key));
        card.append(open);
      }
      return card;
    }
    const state = lineStates.get(line.key);
    if (state?.tone) card.dataset['tone'] = state.tone;
    card.classList.toggle('fd-line-bold', !!state?.bold);
    const shownHere = shownColumns.filter((column) => !state?.cells[column]?.invisible);
    const first = titleColumn(shownHere);
    const rest = shownHere.filter((column) => column !== first);
    const text = (column: string) => cellWords(line, column, parent);
    const title = document.createElement(dialogs ? 'button' : 'div');
    /** Words a person typed, in their own direction (`fd-grid-words`). */
    const typed = (column: string | undefined) => !!column && (def.fields[column]?.type === 'char' || def.fields[column]?.type === 'text');
    title.className = typed(first) ? 'fd-line-card-title fd-grid-words' : 'fd-line-card-title';
    title.textContent = first ? text(first) || placeName(numberOf(line)) : '';
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
      if (typed(column)) dd.className = 'fd-grid-words';
      // What its line's change took out of it, under its value, as on a plain table's card.
      const taken = clearedAt(line, column);
      if (taken) dd.append(Object.assign(document.createElement('div'), { className: 'fd-warning fd-grid-taken-out', textContent: taken }));
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

  // An IME's key on a chosen cell (Process, or a key the keyboard cannot name) opens its editor, focused, for the
  // IME's words: as a letter typed on it does, which the editor then takes as its first.
  host.addEventListener('keydown', (event) => {
    if (readonly || (event.key !== 'Process' && event.key !== 'Unidentified') || !(event.target as HTMLElement).classList.contains('ag-cell')) return;
    const focused = api.getFocusedCell();
    if (!focused || focused.rowPinned || api.getEditingCells().length) return;
    api.startEditingCell({ rowIndex: focused.rowIndex, colKey: focused.column, key: event.key });
  });

  /** Whether a line's cell takes typing now, as its editor would: an item's, not read-only, not worked out, not hidden. */
  const typable = (line: Line, column: string) => {
    const rules = ruleOf(line, column);
    return !readonly && !kindOf(line) && !locked(def.fields[column]) && !rules?.readonly && !rules?.invisible;
  };
  /**
   * A block pasted on a cell — chosen, or open for typing — as a spreadsheet copies one (tabs between cells, a line
   * break between rows): each row on its own line from there, across the columns shown, as the plain table pastes
   * (the lines part's `pasteRows`): each cell read as its column reads what is typed, a link's by its name through the
   * source's search; a row whose name reads as no record not pasted at all; rows past the last line add lines, as many
   * as the table may have (`options.max`). What did not go in is named with why, all of it said in one note. One paste
   * at a time: the next waits for the names of the one before.
   */
  let pasting: Promise<unknown> = Promise.resolve();
  type PasteTable = Parameters<LinesPart['pasteRows']>[0];
  function pasteBlock({ blockOf, pasteRows }: LinesPart, rowIndex: number, startColumn: string, text: string) {
    const shownColumns = api.getAllDisplayedColumns().map((c) => c.getColId()).filter((id) => !isTool(id));
    const dateOrder = dateOrderOf(form);
    const stillShown = form.recordShown();
    const table: PasteTable = {
      fields: def.fields as Record<string, LineField>,
      columns: shownColumns,
      lines,
      add: () => (lines().length >= most ? null : form.addLine(name)),
      typable,
      reading: (line, column) => ({ locale: locale ?? 'en', widget: node.cells?.[column]?.widget, dateOrder, currency: currencyOf(def.fields[column], line.values, form.getState().values) }),
      // Named, and — where its box has words for it — why. By its line's number as people count lines; a section's or a
      // note's by its words.
      cellName: (line, column) => {
        const number = numberOf(line);
        const sub = def.fields[column];
        return number ? fill(labels.cellName, { column: sub.label, n: number }) : fill(labels.cellOfHeading, { column: sub.label, heading: kinds ? String(line.values[kinds.text] ?? '') : '' });
      },
      write: (line, column, value) => {
        form.setUnread(`${name}.${line.key}.${column}`, null);
        form.updateLine(name, line.key, column, value);
      },
      search: (key, column, query, limit, exact) => form.searchLine(name, key, column, query, limit, exact ? { exact: true } : {}),
      choices: (key, column, values) => form.lineChoices(name, key, column, values),
      shown: () => stillShown() && !destroyed,
    };
    pasting = pasting.then(() =>
      pasteRows(table, rowIndex, startColumn, blockOf(text), { labels, locale }).then((said) => {
        if (said === null || destroyed) return;
        pasteNote.textContent = said;
        pasteNote.hidden = !said;
      }, () => undefined)
    );
  }
  /**
   * A paste while one of this grid's cells is chosen (not edited). A browser sends a paste on what is not editable to
   * where its selection is, not to the focused cell: it is heard on the page, and taken when the focus is on a cell.
   */
  /** A block pasted from this cell on: each cell read as its column reads what is typed, by the lines part's readers —
   * asked for the first time a block is pasted (a grid nobody pastes on never loads them), then at once. */
  const pasteFrom = (row: number, column: string, text: string) => {
    const readers = linesPart.loaded;
    if (readers) pasteBlock(readers, row, column, text);
    else void linesPart.load().then((part) => !destroyed && pasteBlock(part, row, column, text), () => undefined);
  };
  pasteInCell = (row, column, text) => {
    if (!readonly) pasteFrom(row, column, text);
  };
  const onPaste = (event: ClipboardEvent) => {
    const focusedCell = document.activeElement;
    if (readonly || !(focusedCell instanceof HTMLElement) || !host.contains(focusedCell) || !focusedCell.classList.contains('ag-cell') || api.getEditingCells().length) return;
    const focused = api.getFocusedCell();
    const text = event.clipboardData?.getData('text/plain');
    if (!focused || focused.rowPinned || !text) return;
    event.preventDefault();
    pasteFrom(focused.rowIndex, focused.column.getColId(), text);
  };
  document.addEventListener('paste', onPaste);
  // Safari (WebKit) sends no paste to what cannot be typed in, as a chosen cell is: Ctrl or ⌘ and V on one moves the
  // focus to a box of the grid's own, out of sight, as the keys go down — the browser pastes into it, and the block is
  // taken from there onto the cell, which gets the focus back. Every other engine pastes this way too, as it pastes.
  let catching: { row: number; column: string } | null = null;
  host.addEventListener(
    'keydown',
    (event) => {
      if (readonly || event.key.toLowerCase() !== 'v' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement;
      const focused = api.getFocusedCell();
      if (!target.classList?.contains('ag-cell') || !focused || focused.rowPinned || api.getEditingCells().length) return;
      catching = { row: focused.rowIndex, column: focused.column.getColId() };
      catcher.value = '';
      catcher.focus({ preventScroll: true });
    },
    true
  );
  catcher.addEventListener('paste', (event) => {
    const at = catching;
    catching = null;
    // Its own: the page's paste listener above is for a paste on a chosen cell itself.
    event.stopPropagation();
    event.preventDefault();
    if (!at) return;
    api.setFocusedCell(at.row, at.column);
    const text = event.clipboardData?.getData('text/plain');
    if (text) pasteFrom(at.row, at.column, text);
  });
  // Nothing pasted (an empty clipboard): the cell has the focus back as the keys come up.
  catcher.addEventListener('keyup', () => {
    if (!catching) return;
    const at = catching;
    catching = null;
    api.setFocusedCell(at.row, at.column);
  });
  // The note goes once the person moves on: a key on a cell, or the grid left.
  host.addEventListener('keydown', (event) => {
    if (!pasteNote.hidden && !(event.ctrlKey || event.metaKey)) pasteNote.hidden = true;
  });
  element.addEventListener('focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null)) pasteNote.hidden = true;
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

  /**
   * The choices from the app's lists of this table's lines, by their cells' paths, as last drawn: each line's asked for
   * as it is drawn — its cells at rest say a choice by its label — drawn again once they change; and a choice taken out
   * as its line changed — no longer in its connection's list, or hidden by its condition — said aloud, once.
   */
  const choicesShown = new Map<string, Choices>();
  const takenShown = new Map<string, string>();
  const listedColumns = columns.filter((column) => { const sub = def.fields[column]; return sub.type === 'selection' && !!optionsList(sub.optionsFrom); });
  let listedSized = false;
  function followChoices(current: readonly Line[]) {
    if (!changingColumns.length) return;
    const items = current.filter((line) => !kindOf(line));
    // Asked, each once, as the line is drawn: an answer the form has already is given at once, the rest as they come.
    for (const line of items) for (const column of listedColumns) if (!form.getState().choices[`${name}.${line.key}.${column}`] && lines().some((one) => one.key === line.key)) form.loadChoices(`${name}.${line.key}.${column}`);
    const changed = new Set<string>();
    const said: string[] = [];
    for (const line of items) {
      for (const column of listedColumns) {
        const path = `${name}.${line.key}.${column}`;
        const now = form.getState().choices[path];
        const was = choicesShown.get(path);
        if (now === was) continue;
        if (now) choicesShown.set(path, now);
        else choicesShown.delete(path);
        changed.add(column);
      }
      for (const column of changingColumns) {
        const path = `${name}.${line.key}.${column}`;
        const words = form.getState().takenOut?.[path];
        if (words === takenShown.get(path)) continue;
        if (words) takenShown.set(path, words);
        else takenShown.delete(path);
        changed.add(column);
        if (words) said.push(fill(labels.lineProblem, { n: numberOf(line), message: words }));
      }
    }
    for (const path of [...choicesShown.keys()]) if (!current.some((line) => path.startsWith(`${name}.${line.key}.`))) choicesShown.delete(path);
    for (const path of [...takenShown.keys()]) if (!current.some((line) => path.startsWith(`${name}.${line.key}.`))) takenShown.delete(path);
    if (changed.size && !api.isDestroyed()) api.refreshCells({ columns: [...changed], force: true, suppressFlash: true });
    // Its words' room once the lines' choices first come, as the lines' room was given: a person's own widths stay.
    if (!listedSized && sizedByLines && items.length && items.every((line) => listedColumns.every((column) => form.getState().choices[`${name}.${line.key}.${column}`]?.options))) {
      listedSized = true;
      const sized = listedColumns.filter((column) => !node.cells?.[column]?.width && !fixedWidth(column));
      if (!Array.isArray(saved) && sized.length && !api.isDestroyed()) api.applyColumnState({ state: sized.map((colId) => ({ colId, flex: roomOf(colId, items) })) });
    }
    if (said.length) voice.textContent = said.join(' ');
  }

  let shown: Line[] | null = null;
  let problemsShown = '';
  /** The text left unread in this table's cells when last drawn: drawn again, and the totals added again, once it changes. */
  let unreadShown = '';
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
      // Each written only once it changes: a key writes none of them.
      if (adds.hidden !== (readonly || full())) adds.hidden = readonly || full();
      for (const { id, button } of controls) if (button.hidden !== form.node(id).invisible) button.hidden = form.node(id).invisible;
      const current = (state.value as Line[] | null) ?? [];
      const unreadNow = JSON.stringify(Object.entries(form.getState().unread ?? {}).filter(([path]) => path.startsWith(`${name}.`)));
      const unreadChanged = unreadNow !== unreadShown;
      unreadShown = unreadNow;
      if (current !== shown) {
        // The same lines in the same order, some of them changed (a key in a line, the server's answer to it): only those
        // given to the grid — never the 200 for it to compare one by one (0.35.1).
        const before = shown;
        const changed = before && before.length === current.length && current.every((line, at) => line.key === before[at].key) ? current.filter((line, at) => line !== before[at]) : null;
        shown = current;
        if (changed) api.applyTransaction({ update: changed });
        else api.setGridOption('rowData', current);
        fitHeight(current.length);
        if (totals.length) api.setGridOption('pinnedBottomRowData', [totalsRow(current)]);
        // Columns as wide as what they hold, once more as the lines change.
        if (node.fit === 'content') api.autoSizeAllColumns();
        sizeByLines(linesOf(current));
        // The ticks and copies name a line by where it is: it may have moved.
        if (choosing || node.options?.['copy'] === true) api.refreshCells({ columns: ['__pick', '__copy'], force: true, suppressFlash: true });
      } else if (unreadChanged && totals.length) api.setGridOption('pinnedBottomRowData', [totalsRow(current)]);
      // Text left unread in a cell shows as typed, marked, and its line's totals wait: drawn again once it changes.
      if (unreadChanged) api.refreshCells({ force: true, suppressFlash: true });
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
        // A line's state the same as before stays the same object (the form keeps it while what its rules read stands): a
        // key in the header compares 200 lines by what they are, never by their words (0.35.1).
        let changed = false;
        const states = new Map<string, LineState>();
        for (const line of current) {
          if (kindOf(line)) continue;
          const now = form.lineState(node.id, line.key);
          const was = lineStates.get(line.key);
          const same = was === now || (!!was && JSON.stringify(was) === JSON.stringify(now));
          if (!same) changed = true;
          states.set(line.key, same && was ? was : now);
        }
        if (states.size !== lineStates.size) changed = true;
        const hidden = new Set(columns.filter((column) => form.columnHidden(node.id, column)));
        if (hidden.size !== ruleHidden.size || [...hidden].some((column) => !ruleHidden.has(column))) changed = true;
        lineStates = states;
        if (changed) {
          const turned = columns.filter((column) => hidden.has(column) !== ruleHidden.has(column));
          ruleHidden = hidden;
          for (const column of turned) api.setColumnsVisible([column], !hidden.has(column) && !hiddenByPerson(column));
          api.refreshCells({ force: true, suppressFlash: true });
          api.redrawRows();
        }
      }
      followChoices(current);
      const found = readonly ? [] : lineProblems();
      const signature = found.map((p) => `${p.index}.${p.column}:${p.message}`).join('|');
      if (signature !== problemsShown) {
        problemsShown = signature;
        api.refreshCells({ force: true, suppressFlash: true });
        const listed = found.slice(0, 3).map((p) => (p.number ? fill(labels.lineProblem, { n: p.number, message: p.message }) : p.message));
        if (found.length > 3) listed.push(fill(labels.moreProblems, { n: found.length - 3 }));
        problems.textContent = listed.join(' · ');
        problems.hidden = !found.length;
      }
      showChosen(false);
      drawCards();
      const invalid = String(state.invalid || found.length > 0);
      if (element.getAttribute('aria-invalid') !== invalid) element.setAttribute('aria-invalid', invalid);
    },
    destroy() {
      destroyed = true;
      view?.removeEventListener('beforeprint', printing);
      view?.removeEventListener('afterprint', printed);
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('paste', onPaste);
      sizes?.disconnect();
      if (back) View?.cancelAnimationFrame(back);
      api.destroy();
      apis.delete(element);
    },
  };
};

/** Pass these to the viewer (`widgets`) to show one2many nodes marked `"widget": "grid"` in the grid. */
export const gridWidgets: Record<string, WidgetFactory> = { 'one2many.grid': gridWidget };
