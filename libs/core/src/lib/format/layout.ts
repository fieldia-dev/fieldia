import * as z from 'zod';
import { FIELD_NAME } from './field';
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
  invisible?: Modifier;
}

export interface TextNode {
  type: 'text';
  id: string;
  text: string;
  style?: 'heading' | 'paragraph' | 'note';
  invisible?: Modifier;
}

/** A named place the app fills with its own content, such as an activity feed. */
export interface SlotNode {
  type: 'slot';
  id: string;
  name: string;
  invisible?: Modifier;
}

export interface SectionNode {
  type: 'section';
  id: string;
  title?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4;
  /** The title folds and unfolds the section. Needs a title. */
  collapsible?: boolean;
  /** A collapsible section that starts folded. */
  collapsed?: boolean;
  invisible?: Modifier;
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
  invisible?: Modifier;
  children: TabNode[];
}

/** A step of a wizard. An invisible step is skipped, which is how surveys branch. */
export interface StepNode {
  type: 'step';
  id: string;
  label: string;
  description?: string;
  invisible?: Modifier;
  children: LayoutNode[];
}

export interface WizardNode {
  type: 'wizard';
  id: string;
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
  invisible?: Modifier;
}

export interface SheetTitle {
  field: string;
  subtitleField?: string;
  avatarField?: string;
  placeholder?: string;
}

export interface Statusbar {
  field: string;
  /** Show only these states, as Flectra-style status bars often do. */
  visibleStates?: (string | number)[];
  /** Clicking a state moves the record to it. */
  clickable?: boolean;
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
  children: LayoutNode[];
  sidePanel?: SlotNode;
}

/** Anything that can sit inside a section, tab, step or sheet. */
export type LayoutNode = FieldNode | ButtonNode | TextNode | SlotNode | SectionNode | TabsNode;

/** What a page's `layout` can be: the four page layouts. */
export type RootLayout = SheetNode | SectionsNode | TabsNode | WizardNode;

// ---------------------------------------------------------------------------
// Schemas. Recursion goes through getters on z.strictObject (zod 4's own
// pattern); `.strict()` would clone the shape and run the getters too early.
// layout.types.ts proves these schemas and the interfaces above agree.
// ---------------------------------------------------------------------------

export const ModifierSchema = z.union([z.boolean(), z.string().min(1)]).meta({ id: 'Modifier' });

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const fieldName = z.string().regex(FIELD_NAME);
const tone = z.enum(['info', 'success', 'warning', 'danger', 'muted']);
const invisible = ModifierSchema.optional();

export const FieldNodeSchema = z.strictObject({
  type: z.literal('field'),
  id,
  field: fieldName,
  label: z.string().optional(),
  widget: z.string().min(1).optional(),
  options: z.record(z.string(), JsonValueSchema).optional(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  colspan: z.int().min(1).max(4).optional(),
  columns: z.array(fieldName).min(1).optional(),
  totals: z.array(fieldName).min(1).optional(),
  optionalColumns: z.record(fieldName, z.enum(['show', 'hide'])).optional(),
  editMode: z.enum(['cell', 'row']).optional(),
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
  invisible,
});

export const TextNodeSchema = z.strictObject({
  type: z.literal('text'),
  id,
  text: z.string(),
  style: z.enum(['heading', 'paragraph', 'note']).optional(),
  invisible,
});

export const SlotNodeSchema = z.strictObject({ type: z.literal('slot'), id, name: z.string().min(1), invisible });

export const SectionNodeSchema = z.strictObject({
  type: z.literal('section'),
  id,
  title: z.string().optional(),
  description: z.string().optional(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  collapsible: z.boolean().optional(),
  collapsed: z.boolean().optional(),
  invisible,
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
  ])
  .meta({ id: 'LayoutNode' });

export const StepNodeSchema = z.strictObject({
  type: z.literal('step'),
  id,
  label: z.string(),
  description: z.string().optional(),
  invisible,
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
}).meta({ id: 'StepNode' });

export const WizardNodeSchema = z.strictObject({
  type: z.literal('wizard'),
  id,
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

export const AlertSchema = z.strictObject({ id, message: z.string(), tone: tone.optional(), invisible });

export const SheetNodeSchema = z.strictObject({
  type: z.literal('sheet'),
  id,
  title: z
    .strictObject({
      field: fieldName,
      subtitleField: fieldName.optional(),
      avatarField: fieldName.optional(),
      placeholder: z.string().optional(),
    })
    .optional(),
  statusbar: z
    .strictObject({
      field: fieldName,
      visibleStates: z.array(z.union([z.string(), z.number()])).optional(),
      clickable: z.boolean().optional(),
    })
    .optional(),
  buttons: z.array(ButtonNodeSchema).optional(),
  statButtons: z.array(StatButtonSchema).optional(),
  ribbon: RibbonSchema.optional(),
  alerts: z.array(AlertSchema).optional(),
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema);
  },
  sidePanel: SlotNodeSchema.optional(),
}).meta({ id: 'SheetNode' });

export const RootLayoutSchema = z
  .discriminatedUnion('type', [SheetNodeSchema, SectionsNodeSchema, TabsNodeSchema, WizardNodeSchema])
  .meta({ id: 'RootLayout' });
