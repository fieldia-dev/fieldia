import * as z from 'zod';
import { FIELD_NAME, FilterItemSchema, type FilterItem } from './field';
import { JsonValueSchema, type JsonValue } from './json';

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

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'muted';

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
   * An expression the answers must keep together, such as `end_date >=
   * start_date` or `paid <= total`: broken when it is false. Checked once
   * every field it reads is filled in.
   */
  holds?: string;
  when?: Modifier;
  message?: string;
  level?: 'error' | 'warning';
}

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
  options?: { [key: string]: JsonValue };
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
  /** Where the label sits, when not where its group or the page puts labels. */
  labels?: LabelPlace;
  /** Rules the answer must keep. */
  validate?: AnswerRule[];
  invisible?: Modifier;
  readonly?: Modifier;
  required?: Modifier;
}

export interface ButtonNode {
  type: 'button';
  id: string;
  label: string;
  /** The action's name. The app decides what it does. */
  action: string;
  params?: { [key: string]: JsonValue };
  style?: 'primary' | 'secondary' | 'danger' | 'link';
  /** Ask before running the action. */
  confirm?: string;
  icon?: string;
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
}

export interface TextNode {
  type: 'text';
  id: string;
  text: string;
  style?: 'heading' | 'paragraph' | 'note';
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
}

/** A line across the whole row, between parts. */
export interface DividerNode {
  type: 'divider';
  id: string;
  invisible?: Modifier;
}

/** Empty room: in a section with columns, an empty cell. */
export interface SpacerNode {
  type: 'spacer';
  id: string;
  colspan?: number;
  invisible?: Modifier;
}

/** A picture between parts, such as a logo. */
export interface ImageNode {
  type: 'image';
  id: string;
  /** An address or a data: URI. */
  src: string;
  /** What it shows, for people who cannot see it. */
  alt: string;
  colspan?: number;
  invisible?: Modifier;
}

/** A named place the app fills with its own content, such as an activity feed. */
export interface SlotNode {
  type: 'slot';
  id: string;
  name: string;
  invisible?: Modifier;
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
  /** A card (the default), plain (nothing drawn), a line under the title, or a frame with the title on it. */
  style?: 'card' | 'plain' | 'line' | 'framed';
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
  children: LayoutNode[];
}

export interface TabsNode {
  type: 'tabs';
  id: string;
  /** Grid columns it spans inside a section. */
  colspan?: number;
  invisible?: Modifier;
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
}

export interface StatButton {
  id: string;
  label: string;
  action: string;
  /** A numeric field shown on the button, such as a count of invoices. */
  field?: string;
  icon?: string;
  invisible?: Modifier;
}

export interface Ribbon {
  id: string;
  label: string;
  tone?: Tone;
  invisible?: Modifier;
}

export interface Alert {
  id: string;
  message: string;
  tone?: Tone;
  /** Has a × that hides it until the page opens again. */
  dismissible?: boolean;
  invisible?: Modifier;
}

/** A small label by the title, such as "Locked" or "VIP". */
export interface Badge {
  id: string;
  label: string;
  tone?: Tone;
  icon?: string;
  invisible?: Modifier;
}

export interface SheetTitle {
  field: string;
  subtitleField?: string;
  avatarField?: string;
  placeholder?: string;
  /** Fields over the title, such as an Individual/Company choice. */
  above?: FieldNode[];
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
  alerts?: Alert[];
  badges?: Badge[];
  children: LayoutNode[];
  sidePanel?: SlotNode;
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
export type LayoutNode = FieldNode | ButtonNode | TextNode | SlotNode | SectionNode | TabsNode | DividerNode | SpacerNode | ImageNode;

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
const span = z.int().min(1).max(12).optional();
const labelPlace = z.enum(['above', 'beside', 'hidden']);

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
    holds: z.string().min(1).optional(),
    when: ModifierSchema.optional(),
    message: z.string().optional(),
    level: z.enum(['error', 'warning']).optional(),
  })
  .refine(
    (r) => ['minLength', 'maxLength', 'pattern', 'endsWith', 'min', 'max', 'atLeast', 'atMost', 'date', 'holds'].some((k) => r[k as keyof typeof r] !== undefined),
    { message: 'an answer rule asks for something: a length, a pattern, an ending, a range, a count, a date or an expression that holds' }
  )
  .meta({ id: 'AnswerRule' });

export const FieldNodeSchema = z.strictObject({
  type: z.literal('field'),
  id,
  field: fieldName,
  label: z.string().optional(),
  widget: z.string().min(1).optional(),
  options: z.record(z.string(), JsonValueSchema).optional(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  colspan: span,
  columns: z.array(fieldName).min(1).optional(),
  totals: z.array(fieldName).min(1).optional(),
  optionalColumns: z.record(fieldName, z.enum(['show', 'hide'])).optional(),
  editMode: z.enum(['cell', 'row']).optional(),
  labels: labelPlace.optional(),
  validate: z.array(AnswerRuleSchema).min(1).optional(),
  invisible,
  readonly: ModifierSchema.optional(),
  required: ModifierSchema.optional(),
});

export const ButtonNodeSchema = z.strictObject({
  type: z.literal('button'),
  id,
  label: z.string(),
  action: z.string().min(1),
  params: z.record(z.string(), JsonValueSchema).optional(),
  style: z.enum(['primary', 'secondary', 'danger', 'link']).optional(),
  confirm: z.string().optional(),
  icon: z.string().optional(),
  colspan: span,
  invisible,
});

export const TextNodeSchema = z.strictObject({
  type: z.literal('text'),
  id,
  text: z.string(),
  style: z.enum(['heading', 'paragraph', 'note']).optional(),
  colspan: span,
  invisible,
});

export const DividerNodeSchema = z.strictObject({ type: z.literal('divider'), id, invisible });

export const SpacerNodeSchema = z.strictObject({ type: z.literal('spacer'), id, colspan: span, invisible });

export const ImageNodeSchema = z.strictObject({ type: z.literal('image'), id, src: z.string().min(1), alt: z.string(), colspan: span, invisible });

export const SlotNodeSchema = z.strictObject({ type: z.literal('slot'), id, name: z.string().min(1), invisible });

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
  style: z.enum(['card', 'plain', 'line', 'framed']).optional(),
  labels: labelPlace.optional(),
  labelWidth: z.int().min(60).max(320).optional(),
  rows: z.enum(['full', 'gaps']).optional(),
  invisible,
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
  invisible,
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
}).meta({ id: 'TabNode' });

export const TabsNodeSchema = z.strictObject({
  type: z.literal('tabs'),
  id,
  colspan: span,
  invisible,
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
  ])
  .meta({ id: 'LayoutNode' });

export const StepNodeSchema = z.strictObject({
  type: z.literal('step'),
  id,
  label: z.string(),
  description: z.string().optional(),
  icon: z.string().min(1).optional(),
  optional: z.boolean().optional(),
  invisible,
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
}).meta({ id: 'SectionsNode' });

export const StatButtonSchema = z.strictObject({
  id,
  label: z.string(),
  action: z.string().min(1),
  field: fieldName.optional(),
  icon: z.string().optional(),
  invisible,
});

export const RibbonSchema = z.strictObject({ id, label: z.string(), tone: tone.optional(), invisible });

export const AlertSchema = z.strictObject({ id, message: z.string(), tone: tone.optional(), dismissible: z.boolean().optional(), invisible });

export const BadgeSchema = z.strictObject({ id, label: z.string(), tone: tone.optional(), icon: z.string().min(1).optional(), invisible });

export const SheetNodeSchema = z.strictObject({
  type: z.literal('sheet'),
  id,
  title: z
    .strictObject({
      field: fieldName,
      subtitleField: fieldName.optional(),
      avatarField: fieldName.optional(),
      placeholder: z.string().optional(),
      above: z.array(FieldNodeSchema).optional(),
      below: z.array(FieldNodeSchema).optional(),
    })
    .optional(),
  statusbar: z
    .strictObject({
      field: fieldName,
      visibleStates: z.array(z.union([z.string(), z.number()])).optional(),
      clickable: z.boolean().optional(),
      position: z.enum(['header', 'title']).optional(),
    })
    .optional(),
  buttons: z.array(ButtonNodeSchema).optional(),
  statButtons: z.array(StatButtonSchema).optional(),
  ribbon: RibbonSchema.optional(),
  alerts: z.array(AlertSchema).optional(),
  badges: z.array(BadgeSchema).optional(),
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
  sidePanel: SlotNodeSchema.optional(),
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
