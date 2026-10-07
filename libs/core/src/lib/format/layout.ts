import * as z from 'zod';
import { FIELD_NAME, FilterItemSchema, type FilterItem } from './field';
import { ActionStepsSchema, type ActionStep } from './actions';
import { JsonValueSchema, type JsonValue } from './json';
import { HOTKEY } from './hotkeys';

/**
 * The layout: where each field goes and what surrounds it.
 *
 * Every element carries a stable `id`, unique within the page, so a designer
 * can select it, undo can name it, and an app can override it. Anything that
 * shows or hides by state takes a modifier: `true`, `false`, or an expression
 * such as `state == 'draft' and amount > 100`.
 */

/** `true`, `false`, or an expression evaluated against the record's values. */
export type Modifier = boolean | string;

/**
 * The roles a part is shown to, as Flectra's `groups=`: people holding any of
 * them see it; a role written `!sales.manager` hides it from people holding
 * that one. The app names the person's roles (the form's `user`). What a
 * page shows is not what a person may do: the app's server enforces that.
 */
export type Roles = string[];

/** Where a field's help shows: as words under it, behind a (?) beside its label, or both. */
export type HelpShown = 'below' | 'tooltip' | 'both';
export const HelpShownSchema = z.enum(['below', 'tooltip', 'both']).meta({ id: 'HelpShown' });

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'muted';

/**
 * A width of the form a part may be hidden at (`hideOn`): `narrow` up to
 * 520px — a phone — `medium` up to 760px, `wide` above, the widths a
 * section's columns change at. Flectra's `d-none d-sm-block`, hidden on a
 * phone, is `["narrow"]`.
 */
export type ScreenWidth = 'narrow' | 'medium' | 'wide';
export const ScreenWidthSchema = z.enum(['narrow', 'medium', 'wide']).meta({ id: 'ScreenWidth' });

/** Where a field's label sits: above its box, beside it, or inside it as the placeholder (still read out by screen readers). */
export type LabelPlace = 'above' | 'beside' | 'hidden';

/**
 * A rule an answer must keep, besides its field's own: a length, a pattern, an
 * ending, a range, how many may be ticked, a date in the past or the future,
 * or an expression across fields that must hold. Each rule may hold only
 * `when` a condition does, say what to show when it is broken, and be a
 * `warning` that is shown without stopping the form. An empty answer passes
 * every rule; `required` decides whether one is needed.
 */
export interface AnswerRule {
  minLength?: number;
  maxLength?: number;
  /** A regular expression the whole answer matches. */
  pattern?: string;
  endsWith?: string;
  min?: number;
  max?: number;
  /** For several choices: at least, at most this many. */
  atLeast?: number;
  atMost?: number;
  date?: 'past' | 'future';
  /**
   * For a table of lines: a column no two of its lines may share a value in,
   * as a model's constraint would refuse it — a split's payers, each once.
   * Empty cells and the sections and notes between lines are left out.
   */
  distinct?: string;
  /**
   * An expression the answers must keep together, such as `end_date >=
   * start_date` or `paid <= total`: broken when it is false. Checked once
   * every field it reads is filled in.
   */
  holds?: string;
  when?: Modifier;
  message?: string;
  level?: 'error' | 'warning';
}

/** A field node's widget settings: the few every widget reads alike, and each widget's own. */
export type WidgetOptions = {
  /**
   * False leaves out "Clear selection" under a single choice that need not be
   * answered — a radio, a rating, a yes/no, a slider, pictures to pick from —
   * as an ERP's radios and priority stars have none; a rating's star picked,
   * clicked again, then takes the answer away. A rating of one star never
   * shows it, and its second click takes the star away.
   */
  clear?: boolean;
} & { [key: string]: JsonValue };

export interface FieldNode {
  type: 'field';
  id: string;
  field: string;
  label?: string;
  /** How the value is shown, when not the type's default: radio, tags, email… */
  widget?: string;
  /**
   * Settings for the widget, as each widget documents them: a progress bar's
   * maximum, a label's prefix. An option whose name ends in "Field" names a field.
   */
  options?: WidgetOptions;
  placeholder?: string;
  help?: string;
  /** Grid columns this field spans inside a section. */
  colspan?: number;
  /** For one2many and many2many: which line fields show as columns. */
  columns?: string[];
  /** For one2many: number columns added up in a totals row under the lines. */
  totals?: string[];
  /** For one2many: columns a person may hide or show, and how each starts. */
  optionalColumns?: { [column: string]: 'show' | 'hide' };
  /** For one2many shown as a grid: edit one cell at a time (the default), or a whole line at once. */
  editMode?: 'cell' | 'row';
  /** For one2many: what each column's cells do, line by line — Flectra's conditions and decorations in a list. */
  cells?: { [column: string]: CellRules };
  /** For one2many: each line's tone while a condition on it holds, the first that holds — Flectra's decoration-* on a list. */
  rowTones?: ToneWhen[];
  /** For one2many: each line's words in bold while this holds on it — Flectra's decoration-bf. */
  rowBold?: Modifier;
  /** For one2many: buttons on each line, each shown by a condition on it; a press runs its steps with the line. */
  rowButtons?: ButtonNode[];
  /**
   * For one2many: buttons for the lines chosen in the table — Flectra's list
   * header buttons, such as Start and Done on the work orders ticked. Each is
   * shown by a condition on the record; a press runs with the chosen lines,
   * and every call of it carries them.
   */
  selectedButtons?: ButtonNode[];
  /** For one2many: buttons in the table's control row, beside Add a line — Flectra's <control>, such as Catalog. Buttons of the record, as any. */
  controlButtons?: ButtonNode[];
  /**
   * For one2many: what a line's ↗ opens — a dialog of every one of its fields
   * (`fields`, the grid's own), or the page of its own record, found by the
   * table's model (`record`), as Flectra's lists open a line's form. A line
   * not saved yet has no record: it opens its fields.
   */
  lineOpens?: 'fields' | 'record';
  /**
   * For one2many: its lines as cards, each column's label by its value — on a
   * narrow form (`narrow`, up to 520px: a phone, as Flectra's mode="tree,kanban"
   * there), or always.
   */
  cards?: 'narrow' | 'always';
  /**
   * For one2many: columns as wide as what they hold (`content`), as Flectra
   * sizes a list's, rather than sharing the table's width; or, in a grid,
   * columns that shrink to fit the table's width (`shrink`), their headers
   * wrapping, before it scrolls — many columns beside a chatter.
   */
  fit?: 'content' | 'shrink';
  /** Where the label sits, when not where its group or the page puts labels. */
  labels?: LabelPlace;
  /** Where its help shows, when not where the page shows help: under it, behind a (?) by its label, or both. */
  helpShown?: HelpShown;
  /** Its value's tone while a condition on the record holds, the first that holds — Flectra's decoration-* on a field. */
  tones?: ToneWhen[];
  /** Its value in bold while this holds — Flectra's decoration-bf on a field. */
  bold?: Modifier;
  /** Rules the answer must keep. */
  validate?: AnswerRule[];
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
  readonly?: Modifier;
  required?: Modifier;
}

/** A tone while a condition holds. */
export interface ToneWhen {
  tone: Tone;
  when: Modifier;
}

/**
 * A column's cells in a table of lines. `invisible`, `readonly`, `required`,
 * `tones` and `bold` are read on each line — its fields, with its record as
 * `parent` — and `hidden` once on the record, hiding the whole column, as
 * Flectra's `column_invisible`.
 */
export interface CellRules {
  invisible?: Modifier;
  readonly?: Modifier;
  required?: Modifier;
  hidden?: Modifier;
  /** The cell's tone while a condition holds, the first that holds. */
  tones?: ToneWhen[];
  bold?: Modifier;
  /** A choice drawn as a coloured pill, toned by `tones`: Flectra's widget="badge". */
  badge?: boolean;
  /**
   * How its cells are shown, as a field node's `widget` — Flectra's widget= on
   * a list's column: a `progressbar`, `priority` stars, a `duration` as HH:MM,
   * a `percentage`, a state `dot`. Text widgets are typed into as the field's
   * box is; drawn ones (bars, stars, dots) are used in the cell itself.
   */
  widget?: string;
  /** Its widget's settings, as a field node's `options`; one ending in "Field" names a field of the line. */
  options?: WidgetOptions;
  /** How wide the column is, in characters of its text. */
  width?: number;
  /**
   * The roles the column is shown to, as Flectra's groups= on a list's
   * column: read once on the person, hiding the whole column as `hidden`
   * does — its cells asked nothing — from people holding none of them.
   */
  roles?: Roles;
}

export interface ButtonNode {
  type: 'button';
  id: string;
  label: string;
  /**
   * What a press does: steps, in order (see `ActionStep`). A button with only
   * an `action` hands its name to the app, as a `call` step would.
   */
  steps?: ActionStep[];
  /** The app's action's name, run after the steps. The app decides what it does. A button has steps, an action, or both. */
  action?: string;
  params?: { [key: string]: JsonValue };
  style?: 'primary' | 'secondary' | 'danger' | 'link';
  /** Ask before running the action. */
  confirm?: string;
  icon?: string;
  /**
   * A key that presses it with Alt, as Flectra's data-hotkey: a letter or a
   * digit, `shift+` before it for Alt+Shift — "v" is Alt+V. Shown on it while
   * Alt is held and in its tooltip; the first shown wins when two share one.
   */
  hotkey?: string;
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
}

export interface TextNode {
  type: 'text';
  id: string;
  /** The words; `{field}` in them shows that field's value, as the field shows it. */
  text: string;
  /** A heading, a paragraph, a note, or an alert's box — Flectra's alert in a tab or a wizard, toned by `tone`. */
  style?: 'heading' | 'paragraph' | 'note' | 'alert';
  /** An alert's colour; blue unless said. */
  tone?: Tone;
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
}

/** A line across the whole row, between parts. */
export interface DividerNode {
  type: 'divider';
  id: string;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
}

/** Empty room: in a section with columns, an empty cell. */
export interface SpacerNode {
  type: 'spacer';
  id: string;
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
}

/** A picture between parts, such as a logo. */
export interface ImageNode {
  type: 'image';
  id: string;
  /** An address or a data: URI. */
  src: string;
  /** What it shows, for people who cannot see it. */
  alt: string;
  /** How wide: small (160px), medium (320px), large (480px), the whole row, or a width in pixels; never wider than its row. Its own width when left out. */
  width?: 'small' | 'medium' | 'large' | 'full' | number;
  /** Where it sits in its row: at the start, in the centre or at the end. */
  align?: 'start' | 'center' | 'end';
  /** A web or mail address it opens, in a new tab. */
  href?: string;
  /** Words under it. */
  caption?: string;
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
}

/**
 * A saved form placed in this one: another page, found by its id, drawn where
 * this part stands, its fields answered and checked as on their own page — its
 * required fields, answer rules, conditions and worked-out values all hold
 * inside it. Its answers are kept under `name`, as an object, so two copies of
 * one form never mix: `{ "home": { "street": … }, "work": { "street": … } }`.
 * It is edited on its own page; this one only places it. A page of sections
 * or tabs can be placed; a wizard, a sheet or a list cannot.
 */
export interface FormNode {
  type: 'form';
  id: string;
  /** The saved page's id. */
  page: string;
  /** A published version to keep to. The latest published version when left out. */
  version?: number;
  /** Where its answers go: the name they are kept under, as a field's are. */
  name: string;
  /** Words over it: the saved page's own title when left out, none when empty. */
  title?: string;
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
  /** Every field inside is read-only while this holds. */
  readonly?: Modifier;
}

/** A named place the app fills with its own content, such as an activity feed. */
export interface SlotNode {
  type: 'slot';
  id: string;
  name: string;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
}

/** A group's columns: one to four for an even grid, or twelve for rows each divided its own way (twelfths). */
export type ColumnCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Columns at each width of the form: `wide` above 760px, `medium` up to 760px,
 * `narrow` up to 520px. A width left out stacks the way the skin does by itself.
 */
export interface ColumnsByWidth {
  wide: ColumnCount;
  medium?: ColumnCount;
  narrow?: ColumnCount;
}

export { wideColumns } from './columns';

/**
 * A group of parts, with columns of its own. A section without a title in the
 * plain style is an arrangement — parts side by side or one under another —
 * and when it sits in a section with columns it lays its parts on the columns
 * it covers there, so they line up with everything above and below.
 */
export interface SectionNode {
  type: 'section';
  id: string;
  title?: string;
  /** An icon before the title, by name: one of Fieldia's own, or one the app adds. */
  icon?: string;
  description?: string;
  columns?: ColumnCount | ColumnsByWidth;
  /** The title folds and unfolds the section. Needs a title. */
  collapsible?: boolean;
  /** A collapsible section that starts folded. */
  collapsed?: boolean;
  /** Grid columns it spans inside the section around it, one to twelve: groups side by side. */
  colspan?: number;
  /**
   * A card (the default), plain (nothing drawn), a line under the title, a
   * frame with the title on it — or `inline`: its parts on one line, each as
   * wide as it needs, with words and buttons among them, wrapping when the line
   * runs out, its title the line's label — Flectra's `<label/><div class="o_row">`,
   * as "Limit attempts [x] to [3] attempts" or a price with Update Prices
   * beside it. Its fields' labels are read out, not shown, unless a field sets
   * its own.
   */
  style?: 'card' | 'plain' | 'line' | 'framed' | 'inline';
  /** Where the labels of the fields inside sit, unless a field says otherwise. */
  labels?: LabelPlace;
  /** How wide labels set beside their boxes are, in pixels. */
  labelWidth?: number;
  /**
   * In a group of twelfths, how the designer keeps its rows as parts come and
   * go: each row full, its parts sharing the width (the default), or with gaps
   * where a part leaves or is narrowed. A form draws the widths given either way.
   */
  rows?: 'full' | 'gaps';
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
  /** Every field inside is read-only while this holds. */
  readonly?: Modifier;
  children: LayoutNode[];
}

export interface TabNode {
  type: 'tab';
  id: string;
  label: string;
  icon?: string;
  invisible?: Modifier;
  roles?: Roles;
  children: LayoutNode[];
}

export interface TabsNode {
  type: 'tabs';
  id: string;
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
  children: TabNode[];
}

/** A step of a wizard. An invisible step is skipped, which is how surveys branch. */
export interface StepNode {
  type: 'step';
  id: string;
  label: string;
  description?: string;
  icon?: string;
  /** Can be skipped: its answers are then left out, and its required fields not asked for. */
  optional?: boolean;
  invisible?: Modifier;
  roles?: Roles;
  children: LayoutNode[];
}

export interface WizardNode {
  type: 'wizard';
  id: string;
  /** The list of steps can be clicked: back to any step, or forward past steps that are complete. */
  clickable?: boolean;
  nextLabel?: string;
  backLabel?: string;
  /** The last step's button. */
  finishLabel?: string;
  children: StepNode[];
}

export interface SectionsNode {
  type: 'sections';
  id: string;
  children: LayoutNode[];
  /**
   * The page's own buttons at its foot: in a dialog or panel, in place of
   * Save & Close and Discard — Flectra's wizard footer, such as Mark as Lost
   * and Cancel. A press runs its steps: one whose steps saved closes the
   * dialog with its answers, a `close` step without.
   */
  footer?: ButtonNode[];
}

export interface StatButton {
  id: string;
  label: string;
  /** The label's words from a field, when it holds any — Flectra's "Next Meeting" — `label` while it is empty. */
  labelField?: string;
  /** What a press does, as a button's. */
  steps?: ActionStep[];
  action?: string;
  /** The field shown on the button, written as the field shows it: a count of invoices, an amount with its currency, hours, a date. */
  field?: string;
  /** Words after the value, such as "Units" or "Days". */
  unit?: string;
  /** The words after the value from a field, such as a product's unit of measure; `unit` while it is empty. */
  unitField?: string;
  /**
   * A second value: "12.5 / 21 Days", or — with `secondLabel` — two values
   * each with its words, one over the other, as Flectra's "In: 3" and "Out: 5".
   */
  secondField?: string;
  /** The second value's words; with them, `label` is the first value's. */
  secondLabel?: string;
  icon?: string;
  invisible?: Modifier;
  roles?: Roles;
}

export interface Ribbon {
  id: string;
  label: string;
  /** The ribbon's words from a field, when it holds any: Flectra's ribbon by outcome. `label` while it is empty. */
  labelField?: string;
  /** Words shown on pointing at it, as Flectra's ribbon's title. */
  tooltip?: string;
  tone?: Tone;
  invisible?: Modifier;
  roles?: Roles;
}

export interface Alert {
  id: string;
  /** The words; `{field}` in them shows that field's value, as the field shows it. */
  message: string;
  /** The words from a field, when it holds any, as Flectra's alert showing the server's warning; `message` while it is empty. */
  messageField?: string;
  /** Buttons inside it, after its words: a link to the duplicate, Retry, Activate. */
  buttons?: ButtonNode[];
  tone?: Tone;
  /** Has a × that hides it until the page opens again. */
  dismissible?: boolean;
  invisible?: Modifier;
  roles?: Roles;
}

/** A small label by the title, such as "Locked" or "VIP". */
export interface Badge {
  id: string;
  label: string;
  tone?: Tone;
  icon?: string;
  invisible?: Modifier;
  roles?: Roles;
}

export interface SheetTitle {
  field: string;
  /** Words over the title, as Flectra's label over its h1: "Product Name", "MO Reference". */
  label?: string;
  subtitleField?: string;
  avatarField?: string;
  placeholder?: string;
  /** Fields over the title, such as an Individual/Company choice. */
  above?: FieldNode[];
  /** Fields on the title's line before it, such as a priority star — Flectra's <h1> holding the priority and the name. */
  before?: FieldNode[];
  /** Fields on the title's line after it, such as a state's dot. */
  after?: FieldNode[];
  /** Fields under the title, such as "Can be sold" and "Can be purchased". */
  below?: FieldNode[];
}

export interface Statusbar {
  field: string;
  /** Show only these states, as Flectra-style status bars often do. */
  visibleStates?: (string | number)[];
  /** Clicking a state moves the record to it. */
  clickable?: boolean;
  /** In the header bar (the default), or in the sheet under the title. */
  position?: 'header' | 'title';
  /**
   * A json field holding the time spent in each step, in seconds, by the
   * step's value — a choice's, or a stage record's id: `{ "3": 86400 }` —
   * shown on each step, as Flectra's statusbar_duration.
   */
  durationsField?: string;
  /** Stages whose record says it is folded go under a More menu at the end, unless the record stands on one: Flectra's fold_field. */
  fold?: boolean;
  /** A click on a step also saves the record at once, as Flectra's does. Needs `clickable`. */
  saves?: boolean;
  invisible?: Modifier;
  roles?: Roles;
}

/**
 * An item of a record's gear menu, as Flectra's Action and Print menus: a
 * press runs its steps, then its `action`, as a button's. A built-in one
 * (`builtin`) needs neither: it archives, brings back, duplicates or deletes
 * the record, in the page's own words, asking first before it archives or
 * deletes. Given steps or an action of its own, it runs those instead — an
 * Archive that opens a departure wizard.
 */
export interface MenuItem {
  id: string;
  /** Its words; a built-in's own, in the page's language, when left out. */
  label?: string;
  /**
   * One of the record's own: `archive` (shown while the record's `active` is
   * not false), `unarchive` (shown while it is), `duplicate` or `delete`.
   */
  builtin?: 'archive' | 'unarchive' | 'duplicate' | 'delete';
  /** Under Print, as Flectra's reports, or among the actions (the default). */
  group?: 'actions' | 'print';
  steps?: ActionStep[];
  /** The app's action's name, run after the steps, such as a server action (Debit Note). */
  action?: string;
  params?: { [key: string]: JsonValue };
  /** Ask before running it. */
  confirm?: string;
  icon?: string;
  invisible?: Modifier;
  roles?: Roles;
}

/**
 * What sits over a record, around its sheet: the gear menu the page fills,
 * and the pager and the breadcrumbs the app fills — they show when the app
 * gives the records round this one (the viewer's `records`) and the trail to
 * it (`breadcrumbs`), unless the page turns them off. In a dialog only the
 * menu shows; on a phone the menu folds into its gear.
 */
export interface RecordToolbar {
  menu?: MenuItem[];
  /** False keeps the pager away even when the app gives the records round this one. */
  pager?: boolean;
  /** False keeps the breadcrumbs away even when the app gives the trail. */
  breadcrumbs?: boolean;
}

/**
 * The record's main attachment beside its sheet, as Flectra's
 * o_attachment_preview: a PDF in the browser's own viewer, or a picture —
 * beside the sheet on a wide form, under it on a narrow one. From a file
 * field of the page, or — without one — the record's attachments as the data
 * source gives them (`attachments`), the first a PDF or a picture.
 */
export interface AttachmentPreview {
  /** A file field (binary or image) whose file shows; its first, when it holds several. */
  field?: string;
  invisible?: Modifier;
  roles?: Roles;
}

/** The record layout: a header with a statusbar and buttons, then the sheet itself. */
export interface SheetNode {
  type: 'sheet';
  id: string;
  title?: SheetTitle;
  statusbar?: Statusbar;
  buttons?: ButtonNode[];
  statButtons?: StatButton[];
  ribbon?: Ribbon;
  /** Several ribbons, each with its condition, as Flectra's web_ribbons: the first one shown wins the corner, after `ribbon`. */
  ribbons?: Ribbon[];
  alerts?: Alert[];
  badges?: Badge[];
  children: LayoutNode[];
  sidePanel?: SlotNode;
  /**
   * Where the side panel stays beside the sheet: on a wide form (the
   * default: from 1000px), or `always` — the sheet narrower, its columns
   * stacking in it as they need — going under it only on a phone.
   */
  sidePanelBeside?: 'wide' | 'always';
  /** The gear menu, and whether the pager and breadcrumbs the app gives show. */
  toolbar?: RecordToolbar;
  /** The record's main attachment, a PDF or a picture, beside the sheet. */
  attachmentPreview?: AttachmentPreview;
  /**
   * The page's own buttons at its foot: in a dialog or panel, in place of
   * Save & Close and Discard — Flectra's wizard footer, such as Mark as Lost
   * and Cancel. A press runs its steps: one whose steps saved closes the
   * dialog with its answers, a `close` step without.
   */
  footer?: ButtonNode[];
}

/** A named filter in a list's search bar, such as "Active" or "Big accounts". */
export interface ListFilter {
  id: string;
  label: string;
  filter: FilterItem[];
}

/**
 * A list of the model's records, with the search bar people know from Odoo:
 * text searched in the fields it names, named filters, Group By, favourites.
 * A row opens its record; the selected ones take the list's buttons.
 */
export interface ListNode {
  type: 'list';
  id: string;
  /** The fields shown, in order. */
  columns: string[];
  /** The order when the list opens: by the first, then the next. */
  sort?: { field: string; desc?: boolean }[];
  /** How many records a page holds; 40 unless said. */
  pageSize?: number;
  /** The fields what is typed in the search bar is looked for in; the columns unless said. */
  searchFields?: string[];
  filters?: ListFilter[];
  /** The filters on when the list opens, by id. */
  defaultFilters?: string[];
  /** The fields the list can be grouped by. */
  groupBy?: string[];
  /** Buttons for the records selected. */
  actions?: ButtonNode[];
}

/** Anything that can sit inside a section, tab, step or sheet. */
export type LayoutNode = FieldNode | ButtonNode | TextNode | SlotNode | SectionNode | TabsNode | DividerNode | SpacerNode | ImageNode | FormNode;

/** What a page's `layout` can be: the four page layouts. */
export type RootLayout = SheetNode | SectionsNode | TabsNode | WizardNode | ListNode;

// ---------------------------------------------------------------------------
// Schemas. Recursion goes through getters on z.strictObject (zod 4's own
// pattern); `.strict()` would clone the shape and run the getters too early.
// layout.types.ts proves these schemas and the interfaces above agree.
// ---------------------------------------------------------------------------

export const ModifierSchema = z.union([z.boolean(), z.string().min(1)]).meta({ id: 'Modifier' });

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const fieldName = z.string().regex(FIELD_NAME);
const tone = z.enum(['info', 'success', 'warning', 'danger', 'muted']);
const columnCount = z.int().min(1).max(12) as unknown as z.ZodType<ColumnCount>;
const invisible = ModifierSchema.optional();
/** A role's name, `!` before it to hide the part from people holding it. */
export const RolesSchema = z.array(z.string().regex(/^!?[A-Za-z0-9_][A-Za-z0-9_.:-]*$/, 'a role is a name such as sales_team.group_sale_manager, with ! before it to hide the part from people holding it')).min(1).meta({ id: 'Roles' });
const roles = RolesSchema.optional();
const hideOn = z.array(ScreenWidthSchema).min(1).optional();
const span = z.int().min(1).max(12).optional();
const labelPlace = z.enum(['above', 'beside', 'hidden']);

export const ToneWhenSchema = z.strictObject({ tone, when: ModifierSchema }).meta({ id: 'ToneWhen' });

export const CellRulesSchema = z
  .strictObject({
    invisible: ModifierSchema.optional(),
    readonly: ModifierSchema.optional(),
    required: ModifierSchema.optional(),
    hidden: ModifierSchema.optional(),
    tones: z.array(ToneWhenSchema).min(1).optional(),
    bold: ModifierSchema.optional(),
    badge: z.boolean().optional(),
    widget: z.string().min(1).optional(),
    options: z.object({ clear: z.boolean().optional() }).catchall(JsonValueSchema).optional(),
    width: z.int().min(1).max(200).optional(),
    roles,
  })
  .meta({ id: 'CellRules' });

export const AnswerRuleSchema = z
  .strictObject({
    minLength: z.int().min(0).optional(),
    maxLength: z.int().min(1).optional(),
    pattern: z.string().min(1).optional(),
    endsWith: z.string().min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    atLeast: z.int().min(0).optional(),
    atMost: z.int().min(1).optional(),
    date: z.enum(['past', 'future']).optional(),
    distinct: fieldName.optional(),
    holds: z.string().min(1).optional(),
    when: ModifierSchema.optional(),
    message: z.string().optional(),
    level: z.enum(['error', 'warning']).optional(),
  })
  .refine(
    (r) => ['minLength', 'maxLength', 'pattern', 'endsWith', 'min', 'max', 'atLeast', 'atMost', 'date', 'distinct', 'holds'].some((k) => r[k as keyof typeof r] !== undefined),
    { message: 'an answer rule asks for something: a length, a pattern, an ending, a range, a count, a date, a column with no value twice or an expression that holds' }
  )
  .meta({ id: 'AnswerRule' });

export const FieldNodeSchema = z.strictObject({
  type: z.literal('field'),
  id,
  field: fieldName,
  label: z.string().optional(),
  widget: z.string().min(1).optional(),
  options: z.object({ clear: z.boolean().optional() }).catchall(JsonValueSchema).optional(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  colspan: span,
  columns: z.array(fieldName).min(1).optional(),
  totals: z.array(fieldName).min(1).optional(),
  optionalColumns: z.record(fieldName, z.enum(['show', 'hide'])).optional(),
  cells: z.record(fieldName, CellRulesSchema).optional(),
  rowTones: z.array(ToneWhenSchema).min(1).optional(),
  rowBold: ModifierSchema.optional(),
  get rowButtons(): z.ZodOptional<z.ZodArray<typeof ButtonNodeSchema>> {
    return z.array(ButtonNodeSchema).min(1).optional();
  },
  get selectedButtons(): z.ZodOptional<z.ZodArray<typeof ButtonNodeSchema>> {
    return z.array(ButtonNodeSchema).min(1).optional();
  },
  get controlButtons(): z.ZodOptional<z.ZodArray<typeof ButtonNodeSchema>> {
    return z.array(ButtonNodeSchema).min(1).optional();
  },
  lineOpens: z.enum(['fields', 'record']).optional(),
  cards: z.enum(['narrow', 'always']).optional(),
  fit: z.enum(['content', 'shrink']).optional(),
  editMode: z.enum(['cell', 'row']).optional(),
  labels: labelPlace.optional(),
  helpShown: HelpShownSchema.optional(),
  tones: z.array(ToneWhenSchema).min(1).optional(),
  bold: ModifierSchema.optional(),
  validate: z.array(AnswerRuleSchema).min(1).optional(),
  invisible, roles, hideOn,
  readonly: ModifierSchema.optional(),
  required: ModifierSchema.optional(),
});

export const ButtonNodeSchema = z.strictObject({
  type: z.literal('button'),
  id,
  label: z.string(),
  steps: ActionStepsSchema.optional(),
  action: z.string().min(1).optional(),
  params: z.record(z.string(), JsonValueSchema).optional(),
  style: z.enum(['primary', 'secondary', 'danger', 'link']).optional(),
  confirm: z.string().optional(),
  icon: z.string().optional(),
  hotkey: z.string().regex(HOTKEY, 'a hotkey is a letter or a digit, in small letters, with shift+ before it for Alt+Shift: "v", "shift+g"').optional(),
  colspan: span,
  invisible, roles, hideOn,
});

export const TextNodeSchema = z.strictObject({
  type: z.literal('text'),
  id,
  text: z.string(),
  style: z.enum(['heading', 'paragraph', 'note', 'alert']).optional(),
  tone: tone.optional(),
  colspan: span,
  invisible, roles, hideOn,
});

export const DividerNodeSchema = z.strictObject({ type: z.literal('divider'), id, invisible, roles, hideOn });

export const SpacerNodeSchema = z.strictObject({ type: z.literal('spacer'), id, colspan: span, invisible, roles, hideOn });

export const ImageNodeSchema = z.strictObject({
  type: z.literal('image'),
  id,
  src: z.string().min(1),
  alt: z.string(),
  width: z.union([z.enum(['small', 'medium', 'large', 'full']), z.int().min(16).max(4000)]).optional(),
  align: z.enum(['start', 'center', 'end']).optional(),
  href: z.string().regex(/^(https?:\/\/|mailto:)\S+$/i, 'a link is a web address, https://…, or a mail address, mailto:…').optional(),
  caption: z.string().optional(),
  colspan: span,
  invisible, roles, hideOn,
});

export const SlotNodeSchema = z.strictObject({ type: z.literal('slot'), id, name: z.string().min(1), invisible, roles, hideOn });

export const FormNodeSchema = z.strictObject({
  type: z.literal('form'),
  id,
  page: id,
  version: z.int().min(1).optional(),
  name: fieldName,
  title: z.string().optional(),
  colspan: span,
  invisible, roles, hideOn,
  readonly: ModifierSchema.optional(),
});

export const SectionNodeSchema = z.strictObject({
  type: z.literal('section'),
  id,
  title: z.string().optional(),
  icon: z.string().min(1).optional(),
  description: z.string().optional(),
  columns: z.union([columnCount, z.strictObject({ wide: columnCount, medium: columnCount.optional(), narrow: columnCount.optional() })]).optional(),
  collapsible: z.boolean().optional(),
  collapsed: z.boolean().optional(),
  colspan: span,
  style: z.enum(['card', 'plain', 'line', 'framed', 'inline']).optional(),
  labels: labelPlace.optional(),
  labelWidth: z.int().min(60).max(320).optional(),
  rows: z.enum(['full', 'gaps']).optional(),
  invisible, roles, hideOn,
  readonly: ModifierSchema.optional(),
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
}).meta({ id: 'SectionNode' });

export const TabNodeSchema = z.strictObject({
  type: z.literal('tab'),
  id,
  label: z.string(),
  icon: z.string().optional(),
  invisible, roles,
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
}).meta({ id: 'TabNode' });

export const TabsNodeSchema = z.strictObject({
  type: z.literal('tabs'),
  id,
  colspan: span,
  invisible, roles, hideOn,
  children: z.array(TabNodeSchema).min(1),
}).meta({ id: 'TabsNode' });

export const LayoutNodeSchema = z
  .discriminatedUnion('type', [
    FieldNodeSchema,
    ButtonNodeSchema,
    TextNodeSchema,
    SlotNodeSchema,
    SectionNodeSchema,
    TabsNodeSchema,
    DividerNodeSchema,
    SpacerNodeSchema,
    ImageNodeSchema,
    FormNodeSchema,
  ])
  .meta({ id: 'LayoutNode' });

export const StepNodeSchema = z.strictObject({
  type: z.literal('step'),
  id,
  label: z.string(),
  description: z.string().optional(),
  icon: z.string().min(1).optional(),
  optional: z.boolean().optional(),
  invisible, roles,
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
}).meta({ id: 'StepNode' });

export const WizardNodeSchema = z.strictObject({
  type: z.literal('wizard'),
  id,
  clickable: z.boolean().optional(),
  nextLabel: z.string().min(1).optional(),
  backLabel: z.string().min(1).optional(),
  finishLabel: z.string().min(1).optional(),
  children: z.array(StepNodeSchema).min(1),
}).meta({ id: 'WizardNode' });

export const SectionsNodeSchema = z.strictObject({
  type: z.literal('sections'),
  id,
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
  footer: z.array(ButtonNodeSchema).min(1).optional(),
}).meta({ id: 'SectionsNode' });

export const StatButtonSchema = z.strictObject({
  id,
  label: z.string(),
  labelField: fieldName.optional(),
  steps: ActionStepsSchema.optional(),
  action: z.string().min(1).optional(),
  field: fieldName.optional(),
  unit: z.string().optional(),
  unitField: fieldName.optional(),
  secondField: fieldName.optional(),
  secondLabel: z.string().optional(),
  icon: z.string().optional(),
  invisible, roles,
});

export const RibbonSchema = z.strictObject({ id, label: z.string(), labelField: fieldName.optional(), tooltip: z.string().optional(), tone: tone.optional(), invisible, roles });

export const AlertSchema = z.strictObject({
  id,
  message: z.string(),
  messageField: fieldName.optional(),
  buttons: z.array(ButtonNodeSchema).min(1).optional(),
  tone: tone.optional(),
  dismissible: z.boolean().optional(),
  invisible,
  roles,
});

export const MenuItemSchema = z
  .strictObject({
    id,
    label: z.string().optional(),
    builtin: z.enum(['archive', 'unarchive', 'duplicate', 'delete']).optional(),
    group: z.enum(['actions', 'print']).optional(),
    steps: ActionStepsSchema.optional(),
    action: z.string().min(1).optional(),
    params: z.record(z.string(), JsonValueSchema).optional(),
    confirm: z.string().optional(),
    icon: z.string().optional(),
    invisible,
    roles,
  })
  .meta({ id: 'MenuItem' });

export const BadgeSchema = z.strictObject({ id, label: z.string(), tone: tone.optional(), icon: z.string().min(1).optional(), invisible, roles });

export const SheetNodeSchema = z.strictObject({
  type: z.literal('sheet'),
  id,
  title: z
    .strictObject({
      field: fieldName,
      label: z.string().optional(),
      subtitleField: fieldName.optional(),
      avatarField: fieldName.optional(),
      placeholder: z.string().optional(),
      above: z.array(FieldNodeSchema).optional(),
      before: z.array(FieldNodeSchema).optional(),
      after: z.array(FieldNodeSchema).optional(),
      below: z.array(FieldNodeSchema).optional(),
    })
    .optional(),
  statusbar: z
    .strictObject({
      field: fieldName,
      visibleStates: z.array(z.union([z.string(), z.number()])).optional(),
      clickable: z.boolean().optional(),
      position: z.enum(['header', 'title']).optional(),
      durationsField: fieldName.optional(),
      fold: z.boolean().optional(),
      saves: z.boolean().optional(),
      invisible,
      roles,
    })
    .optional(),
  buttons: z.array(ButtonNodeSchema).optional(),
  statButtons: z.array(StatButtonSchema).optional(),
  ribbon: RibbonSchema.optional(),
  ribbons: z.array(RibbonSchema).optional(),
  alerts: z.array(AlertSchema).optional(),
  badges: z.array(BadgeSchema).optional(),
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
  sidePanel: SlotNodeSchema.optional(),
  sidePanelBeside: z.enum(['wide', 'always']).optional(),
  toolbar: z
    .strictObject({
      menu: z.array(MenuItemSchema).min(1).optional(),
      pager: z.boolean().optional(),
      breadcrumbs: z.boolean().optional(),
    })
    .optional(),
  attachmentPreview: z.strictObject({ field: fieldName.optional(), invisible, roles }).optional(),
  footer: z.array(ButtonNodeSchema).min(1).optional(),
}).meta({ id: 'SheetNode' });

export const ListNodeSchema = z.strictObject({
  type: z.literal('list'),
  id,
  columns: z.array(fieldName).min(1),
  sort: z.array(z.strictObject({ field: fieldName, desc: z.boolean().optional() })).optional(),
  pageSize: z.int().min(1).max(500).optional(),
  searchFields: z.array(fieldName).optional(),
  filters: z.array(z.strictObject({ id, label: z.string(), filter: z.array(FilterItemSchema).min(1) })).optional(),
  defaultFilters: z.array(id).optional(),
  groupBy: z.array(fieldName).optional(),
  actions: z.array(ButtonNodeSchema).optional(),
}).meta({ id: 'ListNode' });

export const RootLayoutSchema = z
  .discriminatedUnion('type', [SheetNodeSchema, SectionsNodeSchema, TabsNodeSchema, WizardNodeSchema, ListNodeSchema])
  .meta({ id: 'RootLayout' });
