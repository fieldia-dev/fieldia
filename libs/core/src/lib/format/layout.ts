import * as z from 'zod';
import { FIELD_NAME, FilterItemSchema, LinkedFieldSchema, ModifierSchema, MoneyLookSchema, type FilterItem, type LinkedField, type MoneyLook } from './field';
import { ActionStepsSchema, type ActionStep } from './actions';
import { JsonValueSchema, type JsonValue } from './json';
import { HOTKEY } from './hotkeys';
import { AUTOFILL } from './autofill';
import { INPUT_MODES, type InputMode } from './autofill-group';
import { AddressSearchOptionsSchema } from './address-search';
import { pickerOptionIssues } from './picker-options';
import { phoneOptionIssues } from './phone';
import { slotsOptionIssues } from './slots-options';
import { signatureOptionIssues } from './signature-options';
import { codeOptionIssues, recordOptionIssues } from './media-options';
import { SECTION_TRACK } from './section-checks';
import { DATE_PERIODS, type DatePeriod } from '../record/periods';
import type { TotalKind } from '../record/data-source';

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
  /**
   * Words in its empty box chosen by a condition on the record: the first
   * that holds, else `placeholder` — as Flectra's two name fields, "e.g.
   * Lumber Inc" for a company and "e.g. Brandom Freeman" for a person.
   */
  placeholderWhen?: PlaceholderWhen[];
  /**
   * What the browser fills its box in with: a purpose from the HTML standard's list — `name`, `given-name`, `email`,
   * `tel`, `street-address`, `postal-code`, `country`, `organization`, `one-time-code`, `bday`, `cc-number`… — with
   * `shipping`, `billing` or `section-…` before it and `home`, `work` or `mobile` before a phone or an email, as
   * "shipping postal-code" or "work email"; or `off`, so the browser offers nothing. An email box is `email`, a phone
   * box `tel`, a web address `url`, a password `new-password` and an address in parts each part's own unless this
   * says; an address names only whose it is ("shipping"), or `off`. See `AUTOFILL_NAMES`.
   */
  autocomplete?: string;
  /**
   * The keyboard a phone shows for its box: `numeric`, `decimal`, `tel`, `email`, `url`, `search` or `text`. Its kind
   * says it unless this does: a whole number's digits, an email's @, a phone's keypad, and the purpose's own for a
   * line of words (`tel`, `email`, `url`, `one-time-code`, `cc-number`…).
   */
  inputmode?: InputMode;
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
  /**
   * For one2many: the order its lines are put in as they load — by the first
   * line field, then the next, `desc` turning one round — as Flectra's list
   * default_order: `[{ "field": "is_done" }, { "field": "manual_consumption",
   * "desc": true }, { "field": "sequence" }]`. Empty values and false come
   * first, a link goes by its name. A line a person moves, or adds, stays
   * where it is until the lines load again.
   */
  order?: LineOrder[];
  /** For one2many: what each column's cells do, line by line — Flectra's conditions and decorations in a list. */
  cells?: { [column: string]: CellRules };
  /** For one2many: each line's tone while a condition on it holds, the first that holds — Flectra's decoration-* on a list. */
  rowTones?: ToneWhen[];
  /** For one2many: each line's words in bold while this holds on it — Flectra's decoration-bf. */
  rowBold?: Modifier;
  /** For one2many: buttons on each line, each shown by a condition on it; a press runs its steps with the line. */
  rowButtons?: ButtonNode[];
  /**
   * For one2many: a line may be deleted only while this holds on it — its
   * fields, its own `id` (empty until saved), its record as `parent` — as
   * Flectra's `options="{'delete': …}"`: `"parent.state == 'draft' or not
   * id"`. Its × is hidden on a line it keeps, and the form refuses to remove
   * that line. Every line may be deleted when left out.
   */
  lineDelete?: Modifier;
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
   * For one2many: a line opened (↗) as a form of its own, laid out by these
   * parts as a page's are — sections, columns, words, its fields by the
   * line's names — its conditions read on the line, with its record as
   * `parent`: Flectra's <form> inside a one2many. Its fields not placed
   * are kept as they are.
   */
  lineForm?: LineForm;
  /**
   * For one2many: its lines as cards, each column's label by its value — on a
   * narrow form (`narrow`, up to 520px: a phone, as Flectra's mode="tree,kanban"
   * there), or always; `never`, rows at every width. Left out, as `narrow`: a
   * table's boxes and a grid's cells cut their words at a phone's width however
   * its columns share it, and a card gives each its whole width (a grid's cards
   * open a line in its own form to change it; where nothing can open one, a grid
   * stays a grid).
   */
  cards?: 'narrow' | 'always' | 'never';
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
  /**
   * Takes the focus when the record opens, as Flectra's default_focus — in a
   * page, a dialog or a panel — while it shows, and unless the person is
   * busy elsewhere on the screen: the first such field shown wins.
   */
  focus?: boolean;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
  /** `false`: left out on paper (Ctrl+P, Print), as an invoice leaves out its journal items: shown on screen as ever. */
  print?: boolean;
  readonly?: Modifier;
  required?: Modifier;
  // ---- the quiet look ----
  /**
   * Its value as plain words until it is pointed at or entered (the quiet
   * look, as the page's `look.skin: "quiet"` draws every field), or with
   * false in its box though its group or the page is quiet. As its group or
   * the page draws it when left out.
   */
  quiet?: boolean;
  /**
   * Why it is read-only, in plain words — "Set when the bug is resolved": said
   * by the lock beside it while a rule keeps it read-only, when it is pointed
   * at or focused. Its group's reason when left out.
   */
  readonlyReason?: string;
  /**
   * A letter of its label, as a work item's "Stat_e_": Alt with it takes the
   * focus to the field, and the letter is underlined in the label. One letter
   * or digit, in small letters; the first field shown with it wins.
   */
  hotkey?: string;
}

/** A table's line as a form of its own: its parts, as a page's. */
export interface LineForm {
  children: LayoutNode[];
}

/** Words in a field's empty box while a condition holds. */
export interface PlaceholderWhen {
  when: Modifier;
  text: string;
}

/** One field a table's lines are ordered by, as they load. */
export interface LineOrder {
  field: string;
  /** From the highest, the latest, true, Z. */
  desc?: boolean;
}

/** A tone while a condition holds. */
export interface ToneWhen {
  tone: Tone;
  when: Modifier;
  /**
   * A row's tone in words, for a list's and a related list's key over its rows ("Overdue"): its swatch and these words,
   * read by a screen reader too. Without it, the tone has no key.
   */
  label?: string;
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
   * box is; drawn ones (bars, stars, dots) are used in the cell itself. An
   * app's own widget, given to the viewer as `<type>.<widget>`, is named the
   * same way and drawn in every line's cell, writing to that line.
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
  /** Its icon alone: its label is its name, read out, and its tooltip. Needs an icon. */
  iconOnly?: boolean;
  /**
   * A toggle: pressed while this holds (read out as pressed), as Follow is
   * while the record is followed; `pressedLabel` is shown and read meanwhile
   * ("Following").
   */
  pressed?: Modifier;
  pressedLabel?: string;
  /**
   * More choices beside it, under a chevron: a split button when it has steps
   * or an action of its own (Save and Close, with Save in its menu), a menu
   * button when it has neither. Each item runs as the record's gear menu's do.
   */
  menu?: MenuItem[];
  /** The chevron's own icon and name, as Follow's gear: "Notification settings". A chevron, named by the button's label, unless said. */
  menuIcon?: string;
  menuLabel?: string;
  /**
   * The primary look while the record has changes to save, and the quiet one
   * otherwise — still usable, as Save and Close is: with nothing changed it
   * simply closes.
   */
  primaryWhenChanged?: boolean;
}

export interface TextNode {
  type: 'text';
  id: string;
  /** The words; `{field}` in them shows that field's value, as the field shows it. */
  text: string;
  /** A heading, a paragraph, a note, or an alert's box — Flectra's alert in a tab or a wizard, toned by `tone`. */
  style?: 'heading' | 'paragraph' | 'note' | 'alert' | 'help';
  /** An alert's colour; blue unless said. */
  tone?: Tone;
  /** `help`: a light box (the `help` token) with room for an icon at its start, as a work item's Deployment note; the icon by name. */
  icon?: string;
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

/**
 * Another model's records that point at this one — a customer's invoices, a
 * property's viewings, an employee's leave requests — listed inside the
 * record: a page at a time, searched, put in order, counted, each row opening
 * its record. The records are those whose `field` (their link to this
 * record's model) is this record, and that `filter` lets through; the data
 * source's `list` is asked for them as for any list. **View all** opens the
 * app's own list of them (`viewAll`) showing this record's alone; **New**
 * makes one with its link filled in, in a dialog of the page the app gives for
 * `model`, then lists it. Before the record's first save nothing points at it:
 * the part says so, with no New. Without `list` in the data source the part
 * is not shown.
 */
export interface RelatedNode {
  type: 'related';
  id: string;
  /** Words over it, beside its count: "Invoices". None when left out. */
  title?: string;
  /** An icon before the title, by name: one of Fieldia's own, or one the app adds. */
  icon?: string;
  /** The model of the records listed: "invoice". */
  model: string;
  /** Their link to this record, a many2one of theirs: "partner_id". */
  field: string;
  /** The listed records' fields its columns show: plain values — text, numbers, money, yes or no, dates, choices and links. */
  fields: { [name: string]: LinkedField };
  /** The fields shown, in order. */
  columns: string[];
  /** Each column's cells, as a list's: a widget (`dot`, `badge`, `phone`), an icon before the words, a width, a side, a total. */
  cells?: { [column: string]: ListCell };
  /**
   * Each record as a card where the record is as narrow as a phone (520px or
   * less), as a list's (`ListNode.card`): its title, a picture or a person's
   * initials, a few lines and its status as a pill, each a field of its own
   * `fields`; `{}` takes them from the columns. A table on any width unless
   * given.
   */
  card?: ListCard;
  /**
   * Each row's tone while a condition on its record holds, the first that
   * holds, as a list's (`ListNode.rowTones`): its words in that colour, a
   * card's edge. Its conditions read the listed record — its own `fields`,
   * its `id`, `user` and `context` — never this one's.
   */
  rowTones?: ToneWhen[];
  /** Each row's words in bold while this holds on its record, as a list's. */
  rowBold?: Modifier;
  /** What a row in bold means, in words, for the key over its rows, as a list's (`ListNode.rowBoldLabel`). */
  rowBoldLabel?: string;
  /**
   * Buttons on each row and each card, as a list's: each shown by its
   * `invisible` read on the row's record, a press running its steps with
   * that one record (`recordIds`, of `model`) while this record is the one
   * shown; then its records are asked for again.
   */
  rowButtons?: ButtonNode[];
  /** More that the records listed keep to — only posted invoices — as a link's filter: `valueFrom` reads this record. */
  filter?: FilterItem[];
  /** Their order: by the first, then the next. */
  sort?: { field: string; desc?: boolean }[];
  /** How many rows a page holds: 5 unless said. */
  limit?: number;
  /** The fields what is typed in its search is looked for in: its columns unless said. */
  searchFields?: string[];
  /**
   * View all: the app's list page of these records (by its id, as an `open`
   * step names one), opened in a dialog unless `as` says a panel or this
   * record's place, showing only this record's — or opened the app's own way,
   * its `onOpen`. Not offered when left out.
   */
  viewAll?: { page: string; as?: 'dialog' | 'panel' | 'page' };
  /** New, which makes one with its link to this record filled in; offered unless false, where the app gives a page for `model`. */
  create?: boolean;
  /**
   * Where a row's record and New's open: in a dialog of the page the app
   * gives for `model` (`dialog`, the default), or the app's own way (`app`)
   * — its `onOpen` (or its host's `open`) asked first, as View all's is, with
   * `{ page, recordId }` for a row and `{ page, recordId: null, values }` for
   * New, its link to this record among the values; `page` the id of the page
   * the app gives for `model`, else `model` itself. Where the app's way does
   * not take it, the dialog, as with `dialog`.
   */
  open?: 'dialog' | 'app';
  /** Grid columns it spans inside a section: the whole row unless said. */
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
  /** `false`: left out on paper (Ctrl+P, Print), as an invoice leaves out its journal items: shown on screen as ever. */
  print?: boolean;
}

/** A line along the roads between a map's layers: from one place to another, or through a layer's lines in their order. */
export interface MapRoute {
  /** The layer it starts at: a place, or the reader's own. */
  from: string;
  /** The layer it ends at. */
  to?: string;
  /** A layer of lines it goes through, in their order: a delivery round's stops. */
  through?: string;
  /** How it is travelled: by car unless said. */
  mode?: 'car' | 'bike' | 'foot';
  /** The part already travelled fades as `from` moves along it, and the time and distance left are kept up to date. */
  progress?: boolean;
  /** Fields of the record its numbers go into: the seconds and metres left, and its line as GeoJSON. */
  write?: { seconds?: string; metres?: string; line?: string };
}

/**
 * One layer of a form's map: the record's own place (`point`, or `latitude`
 * and `longitude`), a place for each of its lines (`lines`, the place in the
 * line's fields), a route between layers, or the reader's own place.
 */
export interface MapLayer {
  id: string;
  /** What it is, in words: its pins are named by it ("Courier, 4 min"). */
  label?: string;
  point?: string;
  latitude?: string;
  longitude?: string;
  /** A field of lines (one2many): a pin for each line. */
  lines?: string;
  pin?: Pin;
  card?: MapCard;
  /**
   * A place that moves as its fields change: its pin glides there. Without
   * news for `staleAfter` seconds it says when it was last seen; `follow`
   * keeps it in view until the person moves the map.
   */
  live?: { staleAfter?: number; follow?: boolean };
  route?: MapRoute;
  /** The reader's own place, from the browser once they allow it. */
  myLocation?: boolean;
  /** Areas shaded by colour; a click on one writes its key into `choose`. */
  regions?: MapRegions & { choose?: string };
  /** The area within a few minutes' travel of a place, as the map's provider works it out. */
  reachable?: MapReach;
  invisible?: Modifier;
}

/** A tool a map offers under its zoom: the satellite's images, live traffic, full screen, measuring a way; on a list's map, its records nearest first. */
export type MapTool = 'satellite' | 'traffic' | 'fullscreen' | 'measure' | 'nearest';

/**
 * Areas shaded by colour: districts, zones, municipalities. Their borders come
 * from the app, never from Fieldia: its maps' `regions`, a set of GeoJSON
 * borders by name. Each border is known by one of its properties (`key`), the
 * value a record keeps, and named by another.
 */
export interface MapRegions {
  /** The app's set of borders, by the name its maps' settings give it. */
  from: string;
  /** The property of each border that is its key: what a record's field holds. */
  key: string;
  /** The property of each border that names it: its key unless said. */
  name?: string;
  /** What shades an area: on a list's map, `count` (its records: the default there), or a number among each border's properties. */
  shade?: string;
  /** A legend of the shades over the map: on unless false. */
  legend?: boolean;
}

/** The area within `minutes` of a layer's place, by car unless said. */
export interface MapReach {
  /** The layer it is worked out from: a place, or the reader's own. */
  from: string;
  minutes: number;
  mode?: 'car' | 'bike' | 'foot';
}

/**
 * A fence on a form's map: when a layer's place goes into an area, or comes
 * out of it, the page's steps run, as a button's do ("the courier is near:
 * tell the customer"). The area is a field holding one (`area`, as an area
 * field keeps it) or a reachable area of the map (`within`, a layer's id).
 */
export interface MapFence {
  /** The layer whose place is watched: one that moves. */
  layer: string;
  area?: string;
  within?: string;
  when: 'enter' | 'leave';
  steps: ActionStep[];
}

/** A map on a form: the record's places, its lines' places, the routes between them, and the reader's own place, as layers. */
export interface MapNode {
  type: 'map';
  id: string;
  /** Its name, over it and for a screen reader. */
  label?: string;
  layers: MapLayer[];
  /** Height in pixels: 360 unless said. */
  height?: number;
  /** The tools under its zoom: satellite, traffic, fullscreen, measure. */
  tools?: Exclude<MapTool, 'nearest'>[];
  /** Steps run when a layer's place goes into an area or comes out of it. */
  fences?: MapFence[];
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
  roles?: Roles;
  /** Hidden at these widths of the form, such as a phone's: `["narrow"]`. */
  hideOn?: ScreenWidth[];
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
  /** `false`: left out on paper (Ctrl+P, Print), as an invoice leaves out its journal items: shown on screen as ever. */
  print?: boolean;
  /** Every field inside is read-only while this holds. */
  readonly?: Modifier;
  children: LayoutNode[];
  // ---- the quiet look ----
  /** Its fields' values as plain words until each is pointed at or entered, or with false in their boxes though the page is quiet; a field may say otherwise. */
  quiet?: boolean;
  /** Why its fields are read-only, in plain words, for those that give no reason of their own. */
  readonlyReason?: string;
  // ---- a work item's groups ----
  /** Its columns' widths when not even: pixels ("274px"), a share of the row ("50%") or of what is left ("1fr"); one per column. Even columns at a tablet's and a phone's width. */
  tracks?: string[];
  /** Room between its columns, in pixels: the skin's unless said. */
  gap?: number;
  /** Where its fold control sits: before the title (the default), or at the heading's end as ^ and ⌄. */
  foldAt?: 'start' | 'end';
  /** A ⤢ at its heading's end that shows the group alone over the record's body, until pressed again or Escape. Needs a title. */
  maximise?: boolean;
}

export interface TabNode {
  type: 'tab';
  id: string;
  label: string;
  icon?: string;
  invisible?: Modifier;
  roles?: Roles;
  /** `false`: left out on paper (Ctrl+P, Print), its name with it, as an invoice's Journal Items: shown on screen as ever. */
  print?: boolean;
  children: LayoutNode[];
  /** Its icon alone: its label is its name, read out, and its tooltip. Needs an icon. */
  iconOnly?: boolean;
  /**
   * A count in a pill after it, read out with the tab's name ("Links, 0"):
   * a field's — a number's value, a table's or links' lines, a field of
   * files' files, shown at 0 too, as a work item's "Links 0" — or the records
   * a related list in this tab lists (`{ "related": "quotations" }`, by its
   * id): asked of the data source as the record is shown, whether the tab is
   * open or not, and again as the list adds or loses one; hidden until known,
   * and on a record not saved yet.
   */
  count?: string | TabCount;
}

/** What a tab counts other than a field: the records a related list in it lists, by the list's id. */
export interface TabCount {
  related: string;
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
  /**
   * `head`: its tabs at the end of the record head's band, as a work item's
   * Details, History, Links and Attachments, and its panels as the sheet's
   * body. Only for tabs directly in a sheet with a `head`.
   */
  place?: 'head';
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
  /** Words on what it shows, as Flectra's help= on a smart button: its tooltip, and read out as its description. */
  help?: string;
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
  /** Words in the empty title chosen by a condition, the first that holds, else `placeholder`: a company's name or a person's. */
  placeholderWhen?: PlaceholderWhen[];
  /** The title takes the focus as the record opens, as a field node's `focus`: Flectra's default_focus on the name. */
  focus?: boolean;
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
 * deletes — or prints it, as the page prints (a `print` step), under Print.
 * Given steps or an action of its own, it runs those instead — an Archive
 * that opens a departure wizard. The app's own report under Print is an
 * `action` whose answer hands the viewer its file (`ActionResult.file`): its
 * PDF shown over the record, or saved.
 */
export interface MenuItem {
  id: string;
  /** Its words; a built-in's own, in the page's language, when left out. */
  label?: string;
  /**
   * One of the record's own: `archive` (shown while the record's `active` is
   * not false), `unarchive` (shown while it is), `duplicate`, `delete`, or
   * `print`: the record on paper as the page prints it (under Print unless
   * its `group` says otherwise).
   */
  builtin?: 'archive' | 'unarchive' | 'duplicate' | 'delete' | 'print';
  /** Under Print, as Flectra's reports, or among the actions (the default; Print for the built-in `print`). */
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

/**
 * A record's head drawn as a work tracker draws a work item's: its kind's strip
 * of colour along the start edge and a badge (the kind's icon, its name in
 * capitals and the record's number) over the title; the title line, the
 * number before the title; a row of people and links under it, the record's
 * buttons at its end; a band of fields, their labels beside them, "Updated by"
 * and the tabs at its end. In a dialog, the dialog's own title bar and foot
 * give way to it: its maximise and close sit at the badge row's end.
 */
export interface SheetHead {
  /** The record's kind: a strip of its colour along the head's start edge, and a badge — its icon, its name in capitals and the record's number — over the title. */
  kind?: SheetKind;
  /** The row under the title, from its start: fields (their labels hidden and read out) and links such as "1 Comment". */
  meta?: (FieldNode | HeadLink)[];
  /** The row's end: the record's buttons — Save and Close, Follow, Refresh, Undo — with the record's gear menu (`toolbar.menu`) last, as ⋮. */
  actions?: ButtonNode[];
  /** Fields on a band under the head, their labels beside them. */
  band?: HeadBand;
  /** "Updated by Mona Adel: Aug 25" at the band's top end, from a field naming who and a date; a press shows the tab `opens`. */
  updated?: { byField: string; atField: string; opens?: string };
  /** A Copy title button at the title's end while it is pointed at or focused; on unless false. */
  copyTitle?: boolean;
}

/** A record's kind, as its head's strip and badge show it: one kind, or each kind of a field by its value. */
export interface SheetKind {
  /** The field that holds the kind: a selection, or a many2one. Without it, `label` names the one kind. */
  field?: string;
  label?: string;
  /** The record's number in the badge; the record's id when left out. */
  numberField?: string;
  /** The colour and icon of a kind with no look of its own: `#rrggbb`, and an icon by name. */
  colour?: string;
  icon?: string;
  /** Each kind's colour and icon, by the field's value: `{ "bug": { "colour": "#cc293d", "icon": "bug" } }`. */
  looks?: { [value: string]: { colour: string; icon?: string } };
}

/** A link in a record head's row, "1 Comment": a number field's value, then its words, taking the reader to a part of the record or running steps — its words alone when it does neither. */
export interface HeadLink {
  type: 'link';
  id: string;
  icon?: string;
  /** A number field: its value leads the words. */
  field: string;
  /** The words after the number, in the plural it needs: `{ "one": "Comment", "other": "Comments" }`. */
  words: PluralWords;
  /** The part it takes the reader to, by id: its tab shown, its group unfolded, scrolled into view, its first box focused. */
  target?: string;
  /** What a press does besides, as a button's steps. */
  steps?: ActionStep[];
  invisible?: Modifier;
  roles?: Roles;
}

/** A band of fields under a record's head, their labels beside them, on a light ground. */
export interface HeadBand {
  /** Its columns' widths: pixels ("274px"), a share of the row ("50%") or of what is left ("1fr"); one to four. Two even columns unless said. */
  tracks?: string[];
  /** How wide its labels are, beside their values, in pixels: 76 unless said. */
  labelWidth?: number;
  /** Its fields, filling its columns row by row; each in the quiet look unless it says otherwise. */
  children: LayoutNode[];
}

/** The record layout: a header with a statusbar and buttons, then the sheet itself. */
export interface SheetNode {
  type: 'sheet';
  id: string;
  title?: SheetTitle;
  /**
   * The record's head drawn as a work item's (see `SheetHead`). When given,
   * the classic header bar, the statusbar, the badges and the stat buttons are
   * not drawn: the head's actions and band take their place.
   */
  head?: SheetHead;
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
   * default: from 1534px, as Flectra's chatter, under the sheet below), or
   * `always` — the sheet narrower, its columns stacking in it as they need —
   * going under it only on a phone.
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

/**
 * A period a date, or a date and time, falls in, counted from the day the list
 * is looked at — so a filter of it is right every day: today, yesterday, this
 * week or last (a week starting on the page's language's first day), this
 * month or last, this year, the last 7 or 30 days (today the last of them),
 * or overdue (any day before today, for a due date). Days are the page's
 * time zone's.
 */
export interface FilterPeriod {
  field: string;
  is: DatePeriod;
}

/**
 * A named filter in a list's search bar, such as "Active" or "Big accounts":
 * its conditions, a period ("This month", "Overdue"), or both, which hold
 * together.
 */
export interface ListFilter {
  id: string;
  label: string;
  filter?: FilterItem[];
  period?: FilterPeriod;
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
  /** The records on a map, beside the table or instead of it (drawn by @fieldia/map). */
  map?: ListMap;
  /** The records on a calendar, by day, week or month, a press away from the table (drawn by @fieldia/calendar). */
  calendar?: ListCalendar;
  /**
   * Each column's cells, by its field: a widget (`dot` for a state, with its
   * options), an icon before the words from another field (a work item's
   * kind), a width in characters, the side its words keep to.
   */
  cells?: { [column: string]: ListCell };
  /** A box to choose each row, and the buttons for those chosen; on unless false. */
  choose?: boolean;
  /**
   * Whether a header's press puts the list in its column's order; on unless
   * false. A ranked backlog keeps its own order (`sort`, the rank): its
   * headers are words, with no press and no arrow.
   */
  sortable?: boolean;
  /**
   * The search over the list: the search bar (`bar`, the default), or a
   * keyword box and a list of values for each field of `filterFields`
   * (`fields`), as a work tracker's backlog filters.
   */
  search?: 'bar' | 'fields';
  /** The fields the `fields` search offers a list of values for, in order: "Bug ▾", "Active ▾", "Area ▾". */
  filterFields?: string[];
  /**
   * A filter's own name on its button and its list, by field, where the
   * field's label is longer than the bar wants: "Iteration" for Iteration
   * Path. The field's label unless said; translated with the page's words.
   */
  filterLabels?: { [field: string]: string };
  /**
   * The fields of `filterFields` filtered by their range rather than by values
   * ticked, by field: From and To in its list, and the press for each least
   * value it names ("2+" bedrooms) — one chip, "Price: 1,000,000 – 3,000,000".
   * A whole number named here; a decimal, an amount, a date and a date and
   * time are filtered by their range whether named or not.
   */
  filterRanges?: { [field: string]: FilterRange };
  /**
   * How many records each filter finds, beside it: each value in the filter
   * bar's lists ("Villa 12"), and each named filter and favourite in the
   * search bar's menu ("Late 5") — counted with the rest of the search, asked
   * of the data source (`groups`, `totals`), and shown where it can count.
   * Off unless true.
   */
  filterCounts?: boolean;
  /**
   * On a phone (the filter bar 520px wide or less), the filter bar's fields
   * in a sheet over the list, behind a Filters button: every field at once,
   * changed together and shown with "Show 37 homes" — the records they find,
   * counted as they change. Off unless true.
   */
  filterSheet?: boolean;
  /** Rows nested under their parent by this many2one (to the list's own model), with Expand all and Collapse all in the header. */
  parentField?: string;
  /**
   * Export, in the list's bar: the rows ticked — or, none ticked, every
   * record the search finds — as an Excel workbook or a CSV file, the
   * columns as the list shows them. Off unless true, as Edit is: an app
   * that asks for neither shows no new button.
   */
  export?: boolean;
  /**
   * Edit, for the rows ticked (or every one that matches): one field set to
   * one value in each, after a question, each record's permissions kept.
   * Off unless given: true offers the columns that can be changed — not
   * read-only, not worked out, of a kind one value can set — and a list of
   * fields offers those, in its order.
   */
  bulkEdit?: boolean | string[];
  /**
   * Import, in the list's bar: records made from an Excel workbook or a CSV
   * file — its columns matched to the page's fields, each row read and
   * checked by the page's own rules, the rows refused named with why before
   * anything is written, and an Undo that deletes what it made. Off unless
   * given: true offers every field a cell can fill — words, a number, money,
   * yes or no, a date, a choice, a link or links by name; never read-only,
   * worked out, a table of lines, a file — and a list of fields offers those,
   * in its order.
   */
  import?: boolean | string[];
  /**
   * Print, in the list's bar: every record the search finds — every page of
   * them, asked of the data source — under the list's title, its filters in
   * words and the day, the columns as the list shows them, under their Group
   * By headings with their sums, and the totals under them. Off unless true,
   * as Export is.
   */
  print?: boolean;
  /**
   * Each record as a card — its title, a photo, a few lines, its status as a
   * pill — where the list is narrow (a phone: 520px or less), and in its
   * gallery. What it shows, by field; `{}` takes it all from the columns:
   * the name as the title, the first picture column as the photo, the first
   * column drawn as a pill or a dot as the status, the next three as lines.
   * A card keeps what a row has: its box to tick, its press to open, its
   * buttons, its tone; Group By headings and the totals stay over and under
   * the cards. Tables as before unless given.
   */
  card?: ListCard;
  /**
   * The records as cards in a grid, their photos large — homes, products,
   * people — a press away on the list's switcher (Gallery) on any width,
   * each card as `card` says. Offered unless left out.
   */
  gallery?: ListGallery;
  /**
   * Columns a person may hide or show, and how each starts: `show`, or
   * `hide` (offered, hidden until the person shows it), as a table of lines
   * takes them. With any, the list's header has a Columns menu to show, hide
   * and order its columns, a header's edge drags to size its column, the
   * header and the first column stay in view while the rows scroll, and the
   * person's columns are kept for them (the viewer's `preferences`), Reset
   * putting back the page's.
   */
  optionalColumns?: { [column: string]: 'show' | 'hide' };
  /** Each row's tone while a condition on its record holds, the first that holds — Flectra's decoration-* on a list: its words in that colour, a card's edge. */
  rowTones?: ToneWhen[];
  /** Each row's words in bold while this holds on its record — Flectra's decoration-bf. */
  rowBold?: Modifier;
  /**
   * What a row in bold means, in words ("Your own contacts"): with it, a key over the rows says so — a bold sample and
   * these words — beside each `rowTones` item's `label` with its swatch, read by a screen reader too. Without labels,
   * no key.
   */
  rowBoldLabel?: string;
  /**
   * Buttons on each row and each card, each shown by its `invisible` read
   * on the row's record (its fields and `id`); a press runs its steps with
   * that record alone, as a button for the rows chosen runs with them.
   */
  rowButtons?: ButtonNode[];
}

/**
 * A filter of a field's range in a list's filter bar (`ListNode.filterRanges`): From and To, and where it names them,
 * a press for each least value — "Any", "1+", "2+", "3+" — as a buyer chooses bedrooms.
 */
export interface FilterRange {
  /** The least values offered as a press each, in order: [1, 2, 3, 4] draws "1+" to "4+". A number's alone. */
  atLeast?: number[];
}

/** What a list's card shows of its record, by field: the columns' unless said (see `ListNode.card`). */
export interface ListCard {
  /** The words that name the record: the list's name column unless said. */
  title?: string;
  /** Words under the title, smaller: a company under a person's name. None unless said. */
  subtitle?: string;
  /** A picture (an image field, or text holding a picture's address): large on top in the gallery, small beside the words in a narrow list; a person's initials where it is empty. */
  image?: string;
  /** Its lines, in order, as a map card's: a field, a field with words after it, or several on one line. The next three columns unless said. */
  fields?: CardLine[];
  /** A field shown as a pill beside the title, in its column's tones or colours (`cells.<field>.options`). */
  status?: string;
  /** Each line's label beside its value; shown unless false. Hidden, a screen reader still says them. */
  labels?: boolean;
  /** The first line leads: larger and bold, as a home's price heads its card. */
  lead?: boolean;
}

/** A list's gallery: its records as cards in a grid on any width. */
export interface ListGallery {
  /** Whether the list opens on its table (unless said) or on its gallery. */
  opens?: 'list' | 'gallery';
  /** How wide a card is at least: `small` 180px, `medium` 240px (unless said), `large` 320px. */
  size?: 'small' | 'medium' | 'large';
}

/** How a list's column draws its cells. */
export interface ListCell {
  /**
   * A widget for its words: `dot`, a state's coloured dot before them, and
   * `badge`, the value as a pill — each by `options.colours` (`#rrggbb` by
   * value) or `options.tones`; `tags`, links as chips; `image`, a picture's
   * thumbnail, and `avatar`, a round one, a person's initials where it is
   * empty; `progressbar`, a number as a bar (`options.max`, 100 unless
   * said); `percentage` and `duration`, as a table's cells write them; and
   * `phone`, a number read the world over, with a call and a WhatsApp link
   * where `options.links` is true.
   */
  widget?: string;
  options?: WidgetOptions;
  /** An icon before the words, by another field's value: a bug's or a task's icon in its colour before a work item's title. */
  lead?: { field: string; looks: { [value: string]: { icon: string; colour?: string } } };
  /**
   * How wide the column is: in characters of its words (1 to 200), or in
   * pixels for the whole column ("868px", 8 to 4000), as a work tracker sizes
   * its grid's. Words that do not fit end in "…". When every column has a
   * width, the table keeps them: wider than its card, it scrolls sideways;
   * narrower, the room left is after the last column.
   */
  width?: number | `${number}px`;
  /** The side its words keep to: `end` lines up an order's numbers. */
  align?: 'start' | 'end';
  /**
   * The column's total, in a row under the list, on each Group By heading and
   * for the rows ticked: the `sum`, `avg` (average), `min` (lowest) or `max`
   * (highest) of a number column, or the `count` of records holding a value
   * in any column — asked of the data source's `totals`, without which no
   * total shows. An amount is totalled in one currency only.
   */
  total?: TotalKind;
  /**
   * The short rule at its header's end, where a theme parts the columns
   * (Fluent's): `false` for none, as a work tracker draws a column the
   * person cannot size (its Order); a length in pixels ("44px", 0 to 400)
   * draws it that far in from the column's end, before the room a tracker
   * keeps there for a row's tools (its Title's).
   */
  rule?: false | `${number}px`;
}

/**
 * What a pin on a map shows, from its record's fields: a pin, an icon (a
 * fixed one, or the one a field names), a round photo, words alone, or a dot.
 */
export interface Pin {
  look?: 'pin' | 'icon' | 'photo' | 'label' | 'dot';
  /** An icon by name: Fieldia's own and the map's (car, scooter, bike, shop, food…), or the app's. */
  icon?: string;
  /** A field whose value names the icon: a car, a scooter or a bike, record by record. */
  iconField?: string;
  /** An image field: the round photo, such as a driver's face. */
  image?: string;
  /** A field whose value is written on the pin: a price, a name, minutes away. */
  label?: string;
  /** The pin's colour while a condition holds on its record, the first that holds. */
  tones?: ToneWhen[];
  /** A number field, in degrees: which way the pin faces, as a car on a road. */
  turn?: string;
  /** The app's own widget for the pin, by name, drawn from the record. */
  widget?: string;
  /**
   * How an amount on the pin is written, over its field's own `money`: short
   * unless `short` is false, the home currency left unsaid ("13.9M", "$ 450K")
   * — the map's settings' `homeCurrency` unless this says — and what it is
   * for while a condition holds ("/month" on a rent).
   */
  money?: MoneyLook;
}

/** Words after a number, in the plural it needs ("1 bed", "4 beds"): by the language's plural forms, `other` for any it lacks. */
export interface PluralWords {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/** A part of a card's line: a field, or a field with words after its value ("280 m²", "4 beds"). */
export type CardPart = string | { field: string; unit?: string | PluralWords };

/** A line of a card: one part, or several on one line parted by a dot ("Sheikh Zayed · 4 beds · 280 m²"). */
export type CardLine = CardPart | CardPart[];

/** The card a pin opens: its record's title, a picture, a few of its fields, and a way to open it. */
export interface MapCard {
  title?: string;
  image?: string;
  /** Its lines, in order: a field, a field with words after it, or several on one line. */
  fields?: CardLine[];
  /** A button to open the record; on unless false. */
  open?: boolean;
  /** Each line's label beside its value; shown unless false. Hidden, a screen reader still says them. */
  labels?: boolean;
  /** The first line leads: larger and bold, as a home's price heads its card. */
  lead?: boolean;
  /** A field holding the record's address on the web: its title and picture are links there, to open in a new tab or copy. */
  href?: string;
  /** A box to choose the record, as its row's; on unless false. A map people only look at, a buyer's, has none. */
  choose?: boolean;
}

/** A list's records on a map: where each one is, its pin and its card. */
export interface ListMap {
  /** A json field holding a GeoJSON Point; or `latitude` and `longitude`, two number fields. */
  point?: string;
  latitude?: string;
  longitude?: string;
  pin?: Pin;
  card?: MapCard;
  /** Pins that crowd as one bubble with their count; on unless false. */
  cluster?: boolean;
  /** How the list opens: the table, the map, or both side by side on a wide screen. */
  view?: 'list' | 'map' | 'both';
  /** How many records the map shows at most: 500 unless said. */
  limit?: number;
  /** The tools under its zoom: satellite, traffic, fullscreen, measure, nearest (the records nearest the reader first). */
  tools?: MapTool[];
  /** Areas shaded by their records (or a number of their own); `field` is the records' field holding an area's key. A click on one searches for its records. */
  regions?: MapRegions & { field: string };
  /** The records as a heat map while the map is far out, each weighing one unless `weight` names a number field; their pins come back close in, at the streets. */
  heat?: boolean | { weight?: string };
  // ---- how the map sits in its page ----
  /** How tall it is: pixels, or `fill`, as tall as the element it is put in (which gives it a height); as tall as the window allows, 320 to 640 pixels, unless said. */
  height?: number | 'fill';
  /**
   * Which gestures move it: `shared` (unless said) leaves one finger and the
   * wheel to the page, which scrolls past the map, two fingers or Ctrl (⌘)
   * with the wheel moving it; `all` takes every one — one finger pans, the
   * wheel zooms — for a page that is mostly its map.
   */
  gestures?: 'shared' | 'all';
  /** The closest it comes when it fits its records in view: zoom 16 unless said (a neighbourhood is 14, a street 17). */
  fitZoom?: number;
}

/** The spans a list's calendar shows: a day, a week, a month, or the week as a list of what comes (a phone's). */
export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

/**
 * A list's records on a calendar: when each starts and ends, its words, its
 * colour, and the person or room it is with — a column for each in the day
 * view. People move a record by dragging it, or with "Move to…" from the
 * keyboard, and make one by pressing an empty slot.
 */
export interface ListCalendar {
  /** When each record starts: a date (the record takes the whole day) or a date and time field. */
  start: string;
  /** When it ends, a field of the same kind as `start`; with none, a record lasts an hour (a day, for a date) and cannot be stretched. */
  end?: string;
  /** The words on each record's block: the patient, the booking's name. */
  title: string;
  /** A field whose value colours each record: the same value, the same colour. */
  colour?: string;
  /** A field naming who or what each record is with — a doctor, a room: a column for each in the day view. */
  resource?: string;
  /** The views offered, in this order: all four unless said. */
  views?: CalendarView[];
  /** The view it shows first: the first of `views` unless said (`agenda` on a phone). */
  view?: CalendarView;
  /** Whether the list opens on its table (unless said) or on its calendar. */
  opens?: 'list' | 'calendar';
  /** The week's first day, 0 Sunday to 6 Saturday: the language's own unless said. */
  firstDay?: number;
  /** The hours the day and the week show, from 0 to 24: 8 to 20 unless said; a record outside them stretches them. */
  hours?: { start: number; end: number };
  /** The minutes a drag moves by and an empty slot holds: 15, 30 (unless said) or 60. */
  slot?: 15 | 30 | 60;
}

/** Anything that can sit inside a section, tab, step or sheet. */
export type LayoutNode = FieldNode | ButtonNode | TextNode | SlotNode | SectionNode | TabsNode | DividerNode | SpacerNode | ImageNode | FormNode | MapNode | RelatedNode;

/** What a page's `layout` can be: the four page layouts. */
export type RootLayout = SheetNode | SectionsNode | TabsNode | WizardNode | ListNode;

// ---------------------------------------------------------------------------
// Schemas. Recursion goes through getters on z.strictObject (zod 4's own
// pattern); `.strict()` would clone the shape and run the getters too early.
// layout.types.ts proves these schemas and the interfaces above agree.
// ---------------------------------------------------------------------------

export { ModifierSchema };

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const fieldName = z.string().regex(FIELD_NAME);
const tone = z.enum(['info', 'success', 'warning', 'danger', 'muted']);
const columnCount = z.int().min(1).max(12) as unknown as z.ZodType<ColumnCount>;
const invisible = ModifierSchema.optional();
/** A role's name, `!` before it to hide the part from people holding it. */
export const RolesSchema = z.array(z.string().regex(/^!?[A-Za-z0-9_][A-Za-z0-9_.:-]*$/, 'a role is a name such as sales_team.group_sale_manager, with ! before it to hide the part from people holding it')).min(1).meta({ id: 'Roles' });
const roles = RolesSchema.optional();
const hideOn = z.array(ScreenWidthSchema).min(1).optional();
/** `false`: a part left out on paper. */
const print = z.boolean().optional();
const span = z.int().min(1).max(12).optional();
const labelPlace = z.enum(['above', 'beside', 'hidden']);

export const ToneWhenSchema = z.strictObject({ tone, when: ModifierSchema, label: z.string().min(1).optional() }).meta({ id: 'ToneWhen' });
export const PlaceholderWhenSchema = z.strictObject({ when: ModifierSchema, text: z.string() }).meta({ id: 'PlaceholderWhen' });

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
  placeholderWhen: z.array(PlaceholderWhenSchema).min(1).optional(),
  autocomplete: z.string().regex(AUTOFILL, 'a purpose a browser fills in, from the HTML standard, in small letters: "email", "given-name", "shipping postal-code", "off"').optional(),
  inputmode: z.enum(INPUT_MODES).optional(),
  help: z.string().optional(),
  colspan: span,
  columns: z.array(fieldName).min(1).optional(),
  totals: z.array(fieldName).min(1).optional(),
  optionalColumns: z.record(fieldName, z.enum(['show', 'hide'])).optional(),
  order: z.array(z.strictObject({ field: fieldName, desc: z.boolean().optional() }).meta({ id: 'LineOrder' })).min(1).optional(),
  cells: z.record(fieldName, CellRulesSchema).optional(),
  rowTones: z.array(ToneWhenSchema).min(1).optional(),
  rowBold: ModifierSchema.optional(),
  lineDelete: ModifierSchema.optional(),
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
  get lineForm(): z.ZodOptional<typeof LineFormSchema> {
    return LineFormSchema.optional();
  },
  cards: z.enum(['narrow', 'always', 'never']).optional(),
  fit: z.enum(['content', 'shrink']).optional(),
  editMode: z.enum(['cell', 'row']).optional(),
  labels: labelPlace.optional(),
  helpShown: HelpShownSchema.optional(),
  tones: z.array(ToneWhenSchema).min(1).optional(),
  bold: ModifierSchema.optional(),
  validate: z.array(AnswerRuleSchema).min(1).optional(),
  focus: z.boolean().optional(),
  invisible, roles, hideOn, print,
  readonly: ModifierSchema.optional(),
  required: ModifierSchema.optional(),
  // The quiet look.
  quiet: z.boolean().optional(),
  readonlyReason: z.string().min(1).optional(),
  hotkey: z.string().regex(/^[a-z0-9]$/, 'an access key is one letter or digit of the label, in small letters: "e"').optional(),
}).superRefine((node, context) => {
  // A widget's own options, where the format knows them: an address with suggestions.
  for (const issue of [...pickerOptionIssues(node), ...phoneOptionIssues(node), ...slotsOptionIssues(node), ...signatureOptionIssues(node), ...recordOptionIssues(node), ...codeOptionIssues(node)]) context.addIssue({ code: 'custom', ...issue });
  if (node.widget !== 'address-search') return;
  const checked = AddressSearchOptionsSchema.safeParse(node.options ?? {});
  for (const issue of checked.error?.issues ?? []) context.addIssue({ code: 'custom', message: issue.message, path: ['options', ...issue.path] });
});

export const LineFormSchema = z
  .strictObject({
    get children(): z.ZodArray<typeof LayoutNodeSchema> {
      return z.array(LayoutNodeSchema).min(1);
    },
  })
  .meta({ id: 'LineForm' });

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
  iconOnly: z.boolean().optional(),
  pressed: ModifierSchema.optional(),
  pressedLabel: z.string().optional(),
  get menu(): z.ZodOptional<z.ZodArray<typeof MenuItemSchema>> {
    return z.array(MenuItemSchema).min(1).optional();
  },
  menuIcon: z.string().min(1).optional(),
  menuLabel: z.string().optional(),
  primaryWhenChanged: z.boolean().optional(),
});

export const TextNodeSchema = z.strictObject({
  type: z.literal('text'),
  id,
  text: z.string(),
  style: z.enum(['heading', 'paragraph', 'note', 'alert', 'help']).optional(),
  tone: tone.optional(),
  icon: z.string().min(1).optional(),
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

/**
 * What a pin on a map shows, from its record's fields: a pin, an icon (a
 * fixed one or one a field names), a round photo, words alone, or a dot; its
 * words; its colour by condition; its turn, for a car facing its way; or the
 * app's own widget, which draws it from the record.
 */
export const PinSchema = z
  .strictObject({
    look: z.enum(['pin', 'icon', 'photo', 'label', 'dot']).optional(),
    icon: z.string().min(1).optional(),
    iconField: fieldName.optional(),
    image: fieldName.optional(),
    label: fieldName.optional(),
    tones: z.array(ToneWhenSchema).min(1).optional(),
    turn: fieldName.optional(),
    widget: z.string().min(1).optional(),
    money: MoneyLookSchema.optional(),
  })
  .meta({ id: 'Pin' });

export const PluralWordsSchema = z
  .strictObject({ zero: z.string().optional(), one: z.string().optional(), two: z.string().optional(), few: z.string().optional(), many: z.string().optional(), other: z.string() })
  .meta({ id: 'PluralWords' });
/** A part of a card's line: a field, or a field with words after its value. */
export const CardPartSchema = z
  .union([fieldName, z.strictObject({ field: fieldName, unit: z.union([z.string(), PluralWordsSchema]).optional() })])
  .meta({ id: 'CardPart' });

/** The card a pin opens: its record's title, a picture, its lines, a link, and ways to choose and open it. */
export const MapCardSchema = z
  .strictObject({
    title: fieldName.optional(),
    image: fieldName.optional(),
    /** Its lines: a part, or several parts on one line. */
    fields: z.array(z.union([CardPartSchema, z.array(CardPartSchema).min(1)])).min(1).optional(),
    /** A button to open the record (on unless false). */
    open: z.boolean().optional(),
    labels: z.boolean().optional(),
    lead: z.boolean().optional(),
    href: fieldName.optional(),
    choose: z.boolean().optional(),
  })
  .meta({ id: 'MapCard' });

/** A line along the roads between a map's layers: from one place to another, through a layer's lines in their order. */
export const MapRouteSchema = z
  .strictObject({
    from: id,
    to: id.optional(),
    through: id.optional(),
    mode: z.enum(['car', 'bike', 'foot']).optional(),
    progress: z.boolean().optional(),
    write: z.strictObject({ seconds: fieldName.optional(), metres: fieldName.optional(), line: fieldName.optional() }).optional(),
  })
  .meta({ id: 'MapRoute' });

const mapTools = ['satellite', 'traffic', 'fullscreen', 'measure'] as const;

/** Areas shaded by colour, their borders from the app's set by name, each known by a property of its own. */
export const MapRegionsSchema = z
  .strictObject({
    from: z.string().min(1),
    key: z.string().min(1),
    name: z.string().min(1).optional(),
    shade: z.string().min(1).optional(),
    legend: z.boolean().optional(),
  })
  .meta({ id: 'MapRegions' });

/** The area within some minutes' travel of a layer's place. */
export const MapReachSchema = z
  .strictObject({ from: id, minutes: z.number().positive().max(120), mode: z.enum(['car', 'bike', 'foot']).optional() })
  .meta({ id: 'MapReach' });

/** Steps run when a layer's place goes into an area, or comes out of it. */
export const MapFenceSchema = z
  .strictObject({ layer: id, area: fieldName.optional(), within: id.optional(), when: z.enum(['enter', 'leave']), steps: ActionStepsSchema })
  .refine((fence) => (fence.area === undefined) !== (fence.within === undefined), { message: 'a fence is an area field (`area`) or a reachable area of the map (`within`), one of the two' })
  .meta({ id: 'MapFence' });

/** One layer of a form's map: the record's own place, a place for each of its lines, a route, or the reader's own place. */
export const MapLayerSchema = z
  .strictObject({
    id,
    label: z.string().optional(),
    point: fieldName.optional(),
    latitude: fieldName.optional(),
    longitude: fieldName.optional(),
    lines: fieldName.optional(),
    pin: PinSchema.optional(),
    card: MapCardSchema.optional(),
    live: z.strictObject({ staleAfter: z.int().min(5).max(86400).optional(), follow: z.boolean().optional() }).optional(),
    route: MapRouteSchema.optional(),
    myLocation: z.boolean().optional(),
    regions: MapRegionsSchema.extend({ choose: fieldName.optional() }).optional(),
    reachable: MapReachSchema.optional(),
    invisible,
  })
  .meta({ id: 'MapLayer' });

export const MapNodeSchema = z
  .strictObject({
    type: z.literal('map'),
    id,
    label: z.string().optional(),
    layers: z.array(MapLayerSchema).min(1),
    height: z.int().min(160).max(1200).optional(),
    tools: z.array(z.enum(mapTools)).optional(),
    fences: z.array(MapFenceSchema).min(1).optional(),
    colspan: span,
    invisible, roles, hideOn,
  })
  .meta({ id: 'MapNode' });

export const SlotNodeSchema = z.strictObject({ type: z.literal('slot'), id, name: z.string().min(1), invisible, roles, hideOn });

/** A list column's cells: a widget, an icon from another field, a width in characters or pixels, a side, its header's rule, its total. */
export const ListCellSchema = z
  .strictObject({
    widget: z.string().min(1).optional(),
    options: z.object({ clear: z.boolean().optional() }).catchall(JsonValueSchema).optional(),
    lead: z
      .strictObject({
        field: fieldName,
        looks: z.record(z.string(), z.strictObject({ icon: z.string().min(1), colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour is #rrggbb').optional() })),
      })
      .optional(),
    width: z
      .union([
        z.int().min(1).max(200),
        // 8px to 4000px, said in the pattern itself so the JSON Schema says it too.
        z.string().regex(/^([89]|[1-9]\d{1,2}|[1-3]\d{3}|4000)px$/, 'a width in pixels is a whole number from 8 to 4000 and px, as "120px"') as unknown as z.ZodType<`${number}px`>,
      ])
      .optional(),
    align: z.enum(['start', 'end']).optional(),
    total: z.enum(['sum', 'avg', 'min', 'max', 'count']).optional(),
    rule: z
      .union([
        z.literal(false),
        // 0px to 400px, said in the pattern itself so the JSON Schema says it too.
        z.string().regex(/^(\d|[1-9]\d|[1-3]\d{2}|400)px$/, 'a rule set in is a whole number of pixels from 0 to 400 and px, as "44px"') as unknown as z.ZodType<`${number}px`>,
      ])
      .optional(),
  })
  .meta({ id: 'ListCell' });

/** What a list's card shows of its record: its title, subtitle, picture, lines and status, by field. */
export const ListCardSchema = z
  .strictObject({
    title: fieldName.optional(),
    subtitle: fieldName.optional(),
    image: fieldName.optional(),
    /** Its lines: a part, or several parts on one line, as a map card's. */
    fields: z.array(z.union([CardPartSchema, z.array(CardPartSchema).min(1)])).min(1).optional(),
    status: fieldName.optional(),
    labels: z.boolean().optional(),
    lead: z.boolean().optional(),
  })
  .meta({ id: 'ListCard' });

/** A filter of a field's range in a list's filter bar: the least values offered as a press each. */
export const FilterRangeSchema = z
  .strictObject({
    atLeast: z.array(z.number()).min(1).max(12).optional(),
  })
  .meta({ id: 'FilterRange' });

/** A list's gallery: whether the list opens on it, and how wide a card is at least. */
export const ListGallerySchema = z
  .strictObject({
    opens: z.enum(['list', 'gallery']).optional(),
    size: z.enum(['small', 'medium', 'large']).optional(),
  })
  .meta({ id: 'ListGallery' });

/**
 * A related list: another model's records whose link (`field`) is this record, a page at a time, in a record's page.
 * Its columns are fields of its own `fields`.
 */
export const RelatedNodeSchema = z
  .strictObject({
    type: z.literal('related'),
    id,
    title: z.string().optional(),
    icon: z.string().min(1).optional(),
    model: z.string().min(1),
    field: fieldName,
    fields: z.record(fieldName, LinkedFieldSchema),
    columns: z.array(fieldName).min(1),
    cells: z.record(fieldName, ListCellSchema).optional(),
    card: ListCardSchema.optional(),
    rowTones: z.array(ToneWhenSchema).min(1).optional(),
    rowBold: ModifierSchema.optional(),
    rowBoldLabel: z.string().min(1).optional(),
    rowButtons: z.array(ButtonNodeSchema).min(1).optional(),
    filter: z.array(FilterItemSchema).min(1).optional(),
    sort: z.array(z.strictObject({ field: fieldName, desc: z.boolean().optional() })).optional(),
    limit: z.int().min(1).max(100).optional(),
    searchFields: z.array(fieldName).min(1).optional(),
    viewAll: z.strictObject({ page: id, as: z.enum(['dialog', 'panel', 'page']).optional() }).optional(),
    create: z.boolean().optional(),
    open: z.enum(['dialog', 'app']).optional(),
    colspan: span,
    invisible, roles, hideOn, print,
  })
  .meta({ id: 'RelatedNode' });

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
  invisible, roles, hideOn, print,
  readonly: ModifierSchema.optional(),
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
  // The quiet look.
  quiet: z.boolean().optional(),
  readonlyReason: z.string().min(1).optional(),
  // A work item's groups.
  tracks: z.array(z.string().regex(SECTION_TRACK, 'a column is as wide as pixels ("274px"), a share of the row ("50%") or of what is left ("1fr")')).min(1).max(12).optional(),
  gap: z.int().min(0).max(48).optional(),
  foldAt: z.enum(['start', 'end']).optional(),
  maximise: z.boolean().optional(),
}).meta({ id: 'SectionNode' });

export const TabNodeSchema = z.strictObject({
  type: z.literal('tab'),
  id,
  label: z.string(),
  icon: z.string().optional(),
  invisible, roles, print,
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
  iconOnly: z.boolean().optional(),
  count: z.union([fieldName, z.strictObject({ related: id }).meta({ id: 'TabCount' })]).optional(),
}).meta({ id: 'TabNode' });

export const TabsNodeSchema = z.strictObject({
  type: z.literal('tabs'),
  id,
  colspan: span,
  invisible, roles, hideOn,
  children: z.array(TabNodeSchema).min(1),
  place: z.literal('head').optional(),
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
    MapNodeSchema,
    RelatedNodeSchema,
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
  help: z.string().optional(),
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
    builtin: z.enum(['archive', 'unarchive', 'duplicate', 'delete', 'print']).optional(),
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

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour is written #rrggbb: "#cc293d"');

/** A record's kind: its field, or the one kind's words; its number; its colour and icon, by value. */
export const SheetKindSchema = z
  .strictObject({
    field: fieldName.optional(),
    label: z.string().optional(),
    numberField: fieldName.optional(),
    colour: colour.optional(),
    icon: z.string().min(1).optional(),
    looks: z.record(z.string(), z.strictObject({ colour, icon: z.string().min(1).optional() })).optional(),
  })
  .meta({ id: 'SheetKind' });

/** A link in a record head's row: a number field's value and its words, taking the reader to a part or running steps. */
export const HeadLinkSchema = z
  .strictObject({
    type: z.literal('link'),
    id,
    icon: z.string().min(1).optional(),
    field: fieldName,
    words: PluralWordsSchema,
    target: id.optional(),
    steps: ActionStepsSchema.optional(),
    invisible,
    roles,
  })
  .meta({ id: 'HeadLink' });

/** A band of fields under a record's head: its columns, its labels' width, its fields. */
export const HeadBandSchema = z
  .strictObject({
    tracks: z.array(z.string().regex(/^\d+(\.\d+)?(px|%|fr)$/, 'a column is as wide as pixels ("274px"), a share of the row ("50%") or of what is left ("1fr")')).min(1).max(4).optional(),
    labelWidth: z.int().min(48).max(320).optional(),
    children: z.array(LayoutNodeSchema),
  })
  .meta({ id: 'HeadBand' });

/** A record's head drawn as a work item's: kind, row of people and links, actions, band, "Updated by", Copy title. */
export const SheetHeadSchema = z
  .strictObject({
    kind: SheetKindSchema.optional(),
    meta: z.array(z.discriminatedUnion('type', [FieldNodeSchema, HeadLinkSchema])).min(1).optional(),
    actions: z.array(ButtonNodeSchema).min(1).optional(),
    band: HeadBandSchema.optional(),
    updated: z.strictObject({ byField: fieldName, atField: fieldName, opens: id.optional() }).optional(),
    copyTitle: z.boolean().optional(),
  })
  .meta({ id: 'SheetHead' });

export const SheetNodeSchema = z.strictObject({
  type: z.literal('sheet'),
  id,
  head: SheetHeadSchema.optional(),
  title: z
    .strictObject({
      field: fieldName,
      label: z.string().optional(),
      subtitleField: fieldName.optional(),
      avatarField: fieldName.optional(),
      placeholder: z.string().optional(),
      placeholderWhen: z.array(PlaceholderWhenSchema).min(1).optional(),
      focus: z.boolean().optional(),
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

/** A list's records on a map, beside it or instead of it: where each is (a point, or a latitude and a longitude), its pin, its card. */
export const ListMapSchema = z
  .strictObject({
    point: fieldName.optional(),
    latitude: fieldName.optional(),
    longitude: fieldName.optional(),
    pin: PinSchema.optional(),
    card: MapCardSchema.optional(),
    /** Pins that crowd as one bubble with their count (on unless false). */
    cluster: z.boolean().optional(),
    /** How the list opens: the table, the map, or both side by side on a wide screen. */
    view: z.enum(['list', 'map', 'both']).optional(),
    /** How many records the map shows at most: 500 unless said. */
    limit: z.int().min(1).max(5000).optional(),
    tools: z.array(z.enum([...mapTools, 'nearest'])).optional(),
    regions: MapRegionsSchema.extend({ field: fieldName }).optional(),
    heat: z.union([z.boolean(), z.strictObject({ weight: fieldName.optional() })]).optional(),
    // How the map sits in its page: its height, the gestures it takes, the closest a fit comes.
    height: z.union([z.int().min(160).max(2000), z.literal('fill')]).optional(),
    gestures: z.enum(['shared', 'all']).optional(),
    fitZoom: z.int().min(1).max(22).optional(),
  })
  .meta({ id: 'ListMap' });

/** A list's records on a calendar: when each starts and ends, its words, its colour, its person or room, the views, the first day and the hours. */
export const ListCalendarSchema = z
  .strictObject({
    start: fieldName,
    end: fieldName.optional(),
    title: fieldName,
    colour: fieldName.optional(),
    resource: fieldName.optional(),
    views: z.array(z.enum(['day', 'week', 'month', 'agenda'])).min(1).optional(),
    view: z.enum(['day', 'week', 'month', 'agenda']).optional(),
    opens: z.enum(['list', 'calendar']).optional(),
    firstDay: z.int().min(0).max(6).optional(),
    hours: z.strictObject({ start: z.int().min(0).max(23), end: z.int().min(1).max(24) }).optional(),
    slot: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
  })
  .meta({ id: 'ListCalendar' });

/** A period a date falls in, from the day the list is looked at: "This month", "Overdue". */
export const FilterPeriodSchema = z.strictObject({ field: fieldName, is: z.enum(DATE_PERIODS) }).meta({ id: 'FilterPeriod' });

export const ListNodeSchema = z.strictObject({
  type: z.literal('list'),
  id,
  columns: z.array(fieldName).min(1),
  sort: z.array(z.strictObject({ field: fieldName, desc: z.boolean().optional() })).optional(),
  pageSize: z.int().min(1).max(500).optional(),
  searchFields: z.array(fieldName).optional(),
  filters: z
    .array(
      z
        .strictObject({ id, label: z.string(), filter: z.array(FilterItemSchema).min(1).optional(), period: FilterPeriodSchema.optional() })
        .refine((named) => named.filter !== undefined || named.period !== undefined, { message: 'a filter holds conditions (filter), a period (period) or both' })
        .meta({ anyOf: [{ required: ['filter'] }, { required: ['period'] }] })
    )
    .optional(),
  defaultFilters: z.array(id).optional(),
  groupBy: z.array(fieldName).optional(),
  actions: z.array(ButtonNodeSchema).optional(),
  map: ListMapSchema.optional(),
  calendar: ListCalendarSchema.optional(),
  cells: z.record(fieldName, ListCellSchema).optional(),
  choose: z.boolean().optional(),
  sortable: z.boolean().optional(),
  search: z.enum(['bar', 'fields']).optional(),
  filterFields: z.array(fieldName).min(1).optional(),
  filterLabels: z.record(fieldName, z.string().min(1)).optional(),
  filterRanges: z.record(fieldName, FilterRangeSchema).optional(),
  filterCounts: z.boolean().optional(),
  filterSheet: z.boolean().optional(),
  parentField: fieldName.optional(),
  export: z.boolean().optional(),
  bulkEdit: z.union([z.boolean(), z.array(fieldName).min(1)]).optional(),
  import: z.union([z.boolean(), z.array(fieldName).min(1)]).optional(),
  print: z.boolean().optional(),
  card: ListCardSchema.optional(),
  gallery: ListGallerySchema.optional(),
  optionalColumns: z.record(fieldName, z.enum(['show', 'hide'])).optional(),
  rowTones: z.array(ToneWhenSchema).min(1).optional(),
  rowBold: ModifierSchema.optional(),
  rowBoldLabel: z.string().min(1).optional(),
  rowButtons: z.array(ButtonNodeSchema).min(1).optional(),
}).meta({ id: 'ListNode' });

export const RootLayoutSchema = z
  .discriminatedUnion('type', [SheetNodeSchema, SectionsNodeSchema, TabsNodeSchema, WizardNodeSchema, ListNodeSchema])
  .meta({ id: 'RootLayout' });
