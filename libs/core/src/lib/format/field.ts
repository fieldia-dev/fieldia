import * as z from 'zod';
import { JsonValueSchema } from './json';

/**
 * Field definitions: what a page knows about each value it shows or collects.
 *
 * A page declares its fields once, by name, and its layout points at them —
 * the same split a backend's own field metadata uses, so an app can generate
 * these definitions from it. Names follow Fieldia's naming rule: a backend's
 * vocabulary stays unless it is a product name, jargon, or a clash.
 */

import { FIELD_NAME } from './names';
export { FIELD_NAME, FIELD_TYPES, type FieldType } from './names';

/** One choice in a selection or reference. */
export const OptionSchema = z
  .object({
    value: z.union([z.string(), z.number()]),
    label: z.string(),
    /** A picture to choose by: an address or a data: URI. Shown by an image-choice widget. */
    image: z.string().min(1).optional(),
    /** Points this choice is worth, for a quiz or a score. */
    score: z.number().optional(),
    /** What the picture shows, for people who cannot see it. */
    alt: z.string().optional(),
    /** Goes alone, as "None of these": choosing it clears the others, and another clears it — the widgets see to it. */
    exclusive: z.boolean().optional(),
    /** Keeps its place when the options are shuffled. */
    fixed: z.boolean().optional(),
  })
  .strict()
  .meta({ id: 'Option' });

export type Option = z.infer<typeof OptionSchema>;

/**
 * One condition limiting which records a relation may point to. `valueFrom`
 * compares against another field of the record being edited, so a region list
 * can follow the chosen country. `like` finds text inside; `ilike`,
 * `startswith` and `endswith` whatever the case; `set` and `notset` take no
 * value; `between` takes `[low, high]`, both ends included.
 */
export const FilterConditionSchema = z
  .object({
    field: z.string().min(1),
    op: z.enum(['=', '!=', '<', '>', '<=', '>=', 'in', 'not in', 'like', 'ilike', 'startswith', 'endswith', 'set', 'notset', 'between']),
    value: JsonValueSchema.optional(),
    valueFrom: z.string().regex(FIELD_NAME).optional(),
  })
  .strict()
  .refine((c) => (c.op === 'set' || c.op === 'notset' ? c.value === undefined && c.valueFrom === undefined : (c.value === undefined) !== (c.valueFrom === undefined)), {
    message: 'set exactly one of value or valueFrom; set and notset take neither',
  })
  .refine((c) => c.op !== 'between' || c.valueFrom !== undefined || (Array.isArray(c.value) && c.value.length === 2), {
    message: 'between takes value: [low, high]',
  })
  .meta({ id: 'FilterCondition' });

export type FilterCondition = z.infer<typeof FilterConditionSchema>;

/**
 * What a filter holds: conditions, and groups of them. The items of a filter
 * all apply together; an `any` group holds when one of its items does, an
 * `all` group when each does, and groups nest.
 */
export type FilterItem = FilterCondition | { any: FilterItem[] } | { all: FilterItem[] };

export const FilterAnySchema = z.strictObject({
  get any(): z.ZodArray<typeof FilterItemSchema> {
    return z.array(FilterItemSchema).min(1);
  },
}).meta({ id: 'FilterAny' });

export const FilterAllSchema = z.strictObject({
  get all(): z.ZodArray<typeof FilterItemSchema> {
    return z.array(FilterItemSchema).min(1);
  },
}).meta({ id: 'FilterAll' });

export const FilterItemSchema = z.union([FilterConditionSchema, FilterAnySchema, FilterAllSchema]).meta({ id: 'FilterItem' });

/** A value set when a condition starts to hold: `when` is a condition, `value` an expression. People may still change it. */
export const SetWhenSchema = z
  .object({ when: z.string().min(1), value: z.string().min(1) })
  .strict()
  .meta({ id: 'SetWhen' });

export type SetWhen = z.infer<typeof SetWhenSchema>;

const common = {
  label: z.string(),
  help: z.string().optional(),
  required: z.boolean().optional(),
  readonly: z.boolean().optional(),
  default: JsonValueSchema.optional(),
  /** An expression for a value worked out from other fields, such as `price * qty`. The field shows it and cannot be edited. */
  compute: z.string().min(1).optional(),
  /** Values to set when a condition starts to hold, in order. */
  setWhen: z.array(SetWhenSchema).min(1).optional(),
};

const size = z.int().positive().optional();
const digits = z.tuple([z.int().positive(), z.int().nonnegative()]).optional();
const relation = z.string().min(1);
const filter = z.array(FilterItemSchema).optional();

const Char = z.object({ type: z.literal('char'), ...common, size, pattern: z.string().optional() }).strict();
const Text = z.object({ type: z.literal('text'), ...common, size }).strict();
const Html = z.object({ type: z.literal('html'), ...common }).strict();
const Integer = z
  .object({ type: z.literal('integer'), ...common, min: z.number().optional(), max: z.number().optional() })
  .strict();
const Float = z
  .object({ type: z.literal('float'), ...common, min: z.number().optional(), max: z.number().optional(), digits })
  .strict();
const Monetary = z
  .object({
    type: z.literal('monetary'),
    ...common,
    /** The field holding this amount's currency. */
    currencyField: z.string().regex(FIELD_NAME).optional(),
    /** A fixed ISO 4217 currency, when the page has no currency field. */
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    digits,
  })
  .strict();
const BooleanField = z.object({ type: z.literal('boolean'), ...common }).strict();
/**
 * A date's limits: its earliest and latest day, each a day or one counted
 * from the day the form is opened ("today", "today+30", "today-7"), and the
 * days of the week it may fall on, 1 Monday … 7 Sunday (ISO 8601). A date and
 * time keeps them by the day it falls on. A date's `default` may be "today".
 */
const dayLimit = z.string().regex(/^(\d{4}-\d{2}-\d{2}|today([+-]\d{1,4})?)$/).optional();
const days = { min: dayLimit, max: dayLimit, days: z.array(z.int().min(1).max(7)).min(1).optional() };
const DateField = z.object({ type: z.literal('date'), ...common, ...days }).strict();
const DateTime = z.object({ type: z.literal('datetime'), ...common, ...days }).strict();
/**
 * Choices the app gives rather than the page: its list by name, loaded through
 * the data source's `options` when the form shows the field, and again when a
 * field named in `dependsOn` changes — a city list that follows the country.
 */
export const OptionsFromSchema = z
  .object({
    list: z.string().min(1),
    /** The fields the choices change with: the list is asked again when one does. */
    dependsOn: z.array(z.string().regex(FIELD_NAME)).min(1).optional(),
  })
  .strict()
  .meta({ id: 'OptionsFrom' });

export type OptionsFrom = z.infer<typeof OptionsFromSchema>;

const selection = {
  type: z.literal('selection'),
  ...common,
  /** The choices; may be empty when they come from the app's list (`optionsFrom`). */
  options: z.array(OptionSchema),
  /** Several options may be chosen; the value becomes a list. */
  multiple: z.boolean().optional(),
  /**
   * An "Other" choice after the options, with a box to type an answer of
   * one's own: the value is then what was typed — one such answer at most,
   * among the chosen when several may be.
   */
  other: z.boolean().optional(),
  /** People may add answers of their own, as many as they like: tags typed beside the options. */
  ownAnswers: z.boolean().optional(),
};
const Selection = z
  .object({ ...selection, optionsFrom: OptionsFromSchema.optional() })
  .strict()
  .refine((field) => field.options.length > 0 || field.optionsFrom !== undefined, {
    message: 'a choice needs its options, or a list of the app’s to take them from',
    path: ['options'],
  })
  // The same rule for tools that read only the JSON Schema.
  .meta({ anyOf: [{ properties: { options: { minItems: 1 } } }, { required: ['optionsFrom'] }] });
/** A choice in a table's lines: its options written in the page, as a list loads only for the page's own fields. */
const LineSelection = z.object({ ...selection, options: z.array(OptionSchema).min(1), optionsFrom: z.never({ error: 'choices from the app’s lists are for the page’s own fields, not a table’s lines' }).optional() }).strict();
/**
 * What a file or an image field takes: the largest file, and whether it holds
 * several — its value then a list of files, as few as `minFiles` and as many
 * as `maxFiles`. How they are shown, a list or thumbnails, and whether a phone
 * offers its camera, are the layout node's `options` (`files`, `camera`).
 */
const files = {
  /** Largest accepted file, in bytes. */
  maxSize: z.int().positive().optional(),
  /** Several files: the value becomes a list of them. */
  multiple: z.boolean().optional(),
  /** With `multiple`: the fewest files an answer has, once it has any — `required` asks for one. */
  minFiles: z.int().nonnegative().optional(),
  /** With `multiple`: the most files it takes. */
  maxFiles: z.int().positive().optional(),
};
type FileRules = { multiple?: boolean; minFiles?: number; maxFiles?: number };
const SEVERAL = 'the fewest and the most files are for a field of several files: set multiple';
/** The fewest and the most only with several files, the fewest no more than the most — and the same for tools that read only the JSON Schema. */
const withFileRules = <T extends z.ZodType<FileRules>>(schema: T) =>
  schema
    .superRefine((field, context) => {
      for (const key of ['minFiles', 'maxFiles'] as const) if (field[key] !== undefined && field.multiple !== true) context.addIssue({ code: 'custom', message: SEVERAL, path: [key] });
      if (field.minFiles !== undefined && field.maxFiles !== undefined && field.minFiles > field.maxFiles) context.addIssue({ code: 'custom', message: 'the fewest files cannot be more than the most', path: ['minFiles'] });
    })
    .meta({ dependentSchemas: Object.fromEntries(['minFiles', 'maxFiles'].map((key) => [key, { properties: { multiple: { const: true } }, required: ['multiple'] }])) });
const Binary = withFileRules(
  z
    .object({
      type: z.literal('binary'),
      ...common,
      /** Accepted media types, such as "application/pdf" or "image/*". */
      accept: z.array(z.string()).optional(),
      ...files,
    })
    .strict()
);
/** Images only: an image field takes no list of kinds. */
const Image = withFileRules(z.object({ type: z.literal('image'), ...common, ...files }).strict());
const Many2one = z.object({ type: z.literal('many2one'), ...common, relation, filter }).strict();
const Many2many = z.object({ type: z.literal('many2many'), ...common, relation, filter }).strict();
const Reference = z
  .object({ type: z.literal('reference'), ...common, models: z.array(OptionSchema).min(1) })
  .strict();
/** One property of a properties field: its own small field, edited with the widget for its type. */
export const PropertyDefinitionSchema = z
  .object({
    name: z.string().regex(FIELD_NAME),
    label: z.string(),
    type: z.enum(['char', 'text', 'integer', 'float', 'boolean', 'selection', 'date']),
    /** For a choice property. */
    options: z.array(OptionSchema).min(1).optional(),
  })
  .strict()
  .meta({ id: 'PropertyDefinition' });

export type PropertyDefinition = z.infer<typeof PropertyDefinitionSchema>;

const Properties = z
  .object({
    type: z.literal('properties'),
    ...common,
    /** The properties a record may have. Left out, each property is worked out from its value. */
    definitions: z.array(PropertyDefinitionSchema).optional(),
  })
  .strict();
const Json = z.object({ type: z.literal('json'), ...common }).strict();
/**
 * A matrix question: one answer per row, chosen from the columns — a Likert
 * grid. The value is an object of row value to column value, or to a list of
 * column values when several may be chosen in a row.
 */
const Matrix = z
  .object({
    type: z.literal('matrix'),
    ...common,
    rows: z.array(OptionSchema).min(1),
    columns: z.array(OptionSchema).min(1),
    /** Several columns may be chosen in a row. */
    multiple: z.boolean().optional(),
    /** Each column may be chosen in one row only, as a ranking in a grid: picked in a row, it leaves the row that had it. */
    onePerColumn: z.boolean().optional(),
  })
  .strict();

/** A field of a one2many's lines. Lines cannot hold lines of their own. */
export const LineFieldSchema = z
  .discriminatedUnion('type', [
    Char, Text, Html, Integer, Float, Monetary, BooleanField, DateField, DateTime,
    LineSelection, Binary, Image, Many2one, Many2many, Reference, Properties, Json,
  ])
  .meta({ id: 'LineField' });

export type LineField = z.infer<typeof LineFieldSchema>;

/**
 * Lines that are not items: section headings and notes between them, told
 * apart by a line field's value (a backend's `display_type`). Their text spans
 * the row, and they are not asked for the fields an item needs.
 */
export const LineKindsSchema = z
  .object({
    /** The line field whose value says what a line is. */
    field: z.string().regex(FIELD_NAME),
    /** The line field a section or note keeps its text in. */
    text: z.string().regex(FIELD_NAME),
    /** The value that marks a section heading. Default "section". */
    section: z.string().min(1).optional(),
    /** The value that marks a note. Default "note". */
    note: z.string().min(1).optional(),
  })
  .strict()
  .meta({ id: 'LineKinds' });

export type LineKinds = z.infer<typeof LineKindsSchema>;

const One2many = z
  .object({
    type: z.literal('one2many'),
    ...common,
    relation,
    /** The fields of each line, so lines can be edited in place. */
    fields: z.record(z.string().regex(FIELD_NAME), LineFieldSchema),
    lineKinds: LineKindsSchema.optional(),
    /**
     * The integer line field that keeps the lines' order (a backend's
     * `sequence`). With it, people can move lines, and the lines that moved
     * are numbered again.
     */
    sequenceField: z.string().regex(FIELD_NAME).optional(),
  })
  .strict();

export const FieldSchema = z
  .discriminatedUnion('type', [
    Char, Text, Html, Integer, Float, Monetary, BooleanField, DateField, DateTime,
    Selection, Binary, Image, Many2one, Many2many, One2many, Reference, Properties, Json, Matrix,
  ])
  .meta({ id: 'Field' });

export type Field = z.infer<typeof FieldSchema>;

export const FieldsSchema = z.record(z.string().regex(FIELD_NAME), FieldSchema);

export type Fields = z.infer<typeof FieldsSchema>;
