import * as z from 'zod';
import { JsonValueSchema } from './json';
import { isTimeZone } from '../record/zones';
import { QuizQuestionSchema } from './quiz';

/**
 * Field definitions: what a page knows about each value it shows or collects.
 *
 * A page declares its fields once, by name, and its layout points at them —
 * the same split a backend's own field metadata uses, so an app can generate
 * these definitions from it. Names follow Fieldia's naming rule: a backend's
 * vocabulary stays unless it is a product name, jargon, or a clash.
 */

import { FIELD_NAME } from './names';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

export { FIELD_NAME, FIELD_TYPES, type FieldType } from './names';

/** `true`, `false`, or a condition on the record's values, as everything that shows or hides by state takes it (layout.ts `Modifier`). */
export const ModifierSchema = z.union([z.boolean(), z.string().min(1)]).meta({ id: 'Modifier' });

/** One choice in a selection or reference. */
export const OptionSchema = z
  .object({
    value: z.union([z.string(), z.number()]),
    label: z.string(),
    /** A picture to choose by: an address or a data: URI. Shown by an image-choice widget. */
    image: z.string().min(1).optional(),
    /** Points this choice is worth, for a quiz or a score. */
    score: z.number().optional(),
    /** A right answer of a quiz's question (`quiz` on the page): its results say whether the answer chosen was right. */
    correct: z.boolean().optional(),
    /** What the picture shows, for people who cannot see it. */
    alt: z.string().optional(),
    /** Goes alone, as "None of these": choosing it clears the others, and another clears it — the widgets see to it. */
    exclusive: z.boolean().optional(),
    /** Keeps its place when the options are shuffled. */
    fixed: z.boolean().optional(),
    /**
     * How many may choose it — a session's places, a limited offer's stock. With the data source's `limits`, which
     * tells how many took it, the places left show beside it ("3 left"), and a full one says "Full" and is refused when
     * picked (never hidden). Without it, nothing shows: the server refuses as it would.
     */
    seats: z.int().min(0).max(100_000_000).optional(),
    /**
     * A second line under its words, where it is listed — a service's length and price, a plan's limits, a person's
     * role: in Fieldia's own list, a list that searches, radios and checkboxes (a choice with one is drawn in Fieldia's
     * own list, never the browser's, which shows one line).
     */
    caption: z.string().min(1).optional(),
    /** A picture beside its words, by the name of one of Fieldia's icons, or the app's: "home", "truck", "user". */
    icon: z.string().min(1).optional(),
    /** Its colour, as #rrggbb: a dot beside its words — a stage's, a team's, a label's. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour is #rrggbb, such as "#0b5cad"').optional(),
  })
  .strict()
  .meta({ id: 'Option' });

export type Option = z.infer<typeof OptionSchema>;

/**
 * One choice of a page's own selection or a table line's, which may show or hide by a condition on the record's other
 * answers — a line's, on the line's values and `parent.` the record's — (`invisible`, as a part's): "Garden" hidden
 * unless the unit is a villa. A choice that a change hides while it is chosen is taken out of the answer, and the form
 * says so; one the record held as it was opened stays, and is said.
 */
export const SelectionOptionSchema = OptionSchema.extend({ invisible: ModifierSchema.optional() }).strict().meta({ id: 'SelectionOption' });

export type SelectionOption = z.infer<typeof SelectionOptionSchema>;

/**
 * One condition limiting which records a relation may point to. `valueFrom`
 * compares against another field of the record being edited, so a region list
 * can follow the chosen country — or its `id`, the person (`user.id`), a value
 * the app passes in (`context.restricted_picking_type_code`, as Flectra's
 * context), or on a line the record it is on (`parent.company_id`). `like` finds text inside; `ilike`,
 * `startswith` and `endswith` whatever the case; `set` and `notset` take no
 * value; `between` takes `[low, high]`, both ends included. `contains` holds
 * when a record's list of links (a many2many) holds the value, or one of a
 * list of them — Flectra's `=` and `in` on a many2many — and `not contains`
 * when it holds none. `=?` is `=` while its value is set, and left out of the
 * filter while it is empty (nothing, false, empty text or an empty list), as
 * Flectra's `=?`: "this company, if the record has one".
 */
/** What a filter's `valueFrom` may name: a field, `parent.` and a field of the record a line is on, `user.` and a part of the person, or `context.` and a value the app passes in. */
const VALUE_FROM = /^((parent|user|context)\.)?[A-Za-z_][A-Za-z0-9_]*$/;

export const FilterConditionSchema = z
  .object({
    field: z.string().min(1),
    op: z.enum(['=', '!=', '<', '>', '<=', '>=', 'in', 'not in', 'like', 'ilike', 'startswith', 'endswith', 'set', 'notset', 'between', 'contains', 'not contains', '=?', 'within']),
    value: JsonValueSchema.optional(),
    valueFrom: z.string().regex(VALUE_FROM).optional(),
  })
  .strict()
  .refine((c) => (c.op === 'set' || c.op === 'notset' ? c.value === undefined && c.valueFrom === undefined : (c.value === undefined) !== (c.valueFrom === undefined)), {
    message: 'set exactly one of value or valueFrom; set and notset take neither',
  })
  .refine((c) => c.op !== 'between' || c.valueFrom !== undefined || (Array.isArray(c.value) && c.value.length === 2), {
    message: 'between takes value: [low, high]',
  })
  // A place (a GeoJSON point in a json field) inside a box on the map, as a map's "In this area" asks.
  .refine(
    (c) => {
      if (c.op !== 'within' || c.valueFrom !== undefined) return true;
      const area = c.value as Record<string, unknown> | undefined;
      if (!area || typeof area !== 'object' || Array.isArray(area)) return false;
      if (area['longitude'] !== undefined && typeof area['longitude'] !== 'string') return false;
      const pair = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number');
      if (area['polygon'] !== undefined) return Array.isArray(area['polygon']) && area['polygon'].length >= 3 && area['polygon'].every(pair);
      if (area['center'] !== undefined) return pair(area['center']) && typeof area['radius'] === 'number' && area['radius'] > 0;
      return ['south', 'west', 'north', 'east'].every((side) => typeof area[side] === 'number');
    },
    {
      message:
        'within takes value: a box { south, west, north, east }, a { polygon: [[longitude, latitude], …] } or a { center: [longitude, latitude], radius } in metres, all in degrees; with longitude: "a field" when the field is a latitude',
    }
  )
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

/**
 * A value set when a condition starts to hold: `when` is a condition, `value`
 * an expression. People may still change it. With `on`, it is set when one of
 * those fields changes instead — while `when` holds, if it has one — as
 * Flectra's onchange: "ticking Certification sets the scoring".
 */
export const SetWhenSchema = z
  .object({
    when: z.string().min(1).optional(),
    value: z.string().min(1),
    /** The fields whose change sets it: set as one of them changes, never as `when` alone starts to hold. */
    on: z.array(z.string().regex(FIELD_NAME)).min(1).optional(),
  })
  .strict()
  .refine((rule) => rule.when !== undefined || rule.on !== undefined, { message: 'a value is set when a condition starts to hold, or when a field it is on changes: give when, on or both' })
  .meta({ id: 'SetWhen', anyOf: [{ required: ['when'] }, { required: ['on'] }] });

export type SetWhen = z.infer<typeof SetWhenSchema>;

const common = {
  label: z.string(),
  help: z.string().optional(),
  required: z.boolean().optional(),
  readonly: z.boolean().optional(),
  /**
   * A value never kept in the browser: a PIN, an ID number, a code. Its value goes with a save or a send, but never into
   * a draft (in the browser's store or on the app's server), as a password box's never does.
   */
  secret: z.boolean().optional(),
  default: JsonValueSchema.optional(),
  /**
   * A new record's — or a new line's — first value, worked out: an expression
   * over its values, where a field named alone is taken whole and `user` is
   * the person using the form, as a link. On a line, `parent` is its record.
   */
  defaultFrom: z.string().min(1).optional(),
  /** An expression for a value worked out from other fields, such as `price * qty`. The field shows it and cannot be edited. */
  compute: z.string().min(1).optional(),
  /** Values to set when a condition starts to hold, in order. */
  setWhen: z.array(SetWhenSchema).min(1).optional(),
};

const size = z.int().positive().optional();
const digits = z.tuple([z.int().positive(), z.int().nonnegative()]).optional();
const relation = z.string().min(1);
const filter = z.array(FilterItemSchema).optional();
/** Fields and what each starts with: an expression, a field named alone taken whole. */
const valueMap = z.record(z.string().regex(FIELD_NAME), z.string().min(1));
/**
 * What a record made from a link starts with besides its name — by Create
 * and edit…, or made at once from what was typed: each an expression over
 * this record's values (on a line, the line's, with `parent`), as Flectra's
 * `context="{'default_…': …}"`.
 */
const createValues = valueMap.optional();

/** A language by its BCP 47 tag, as a text kept in several languages is keyed: "ar", "en", "pt-BR", "zh-Hant". */
export const LanguageTagSchema = z
  .string()
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'a language is written as its BCP 47 tag: "ar", "en", "pt-BR"')
  .meta({ id: 'LanguageTag', description: 'A language by its BCP 47 tag.', examples: ['ar', 'en', 'fr', 'pt-BR'] });

/**
 * A text kept in several languages, each typed by a person — never translated by a machine: its value is an object of
 * each language's text, `{ "ar": "…", "en": "…" }`, a language not typed yet left out (none typed: no value). A switch
 * on the field shows one language at a time, the reader's first, each written its own way (Arabic right to left); a
 * list's cells and cards show the reader's, else another, marked with it; a search finds either.
 */
const languages = {
  /** The languages its text is kept in, two or more: `["ar", "en"]`. A line, a paragraph or formatted text. */
  translate: z.array(LanguageTagSchema).min(2).meta({ uniqueItems: true }).optional(),
  /** Of those, the languages a required answer is typed in: every one when left out. */
  requiredIn: z.array(LanguageTagSchema).min(1).meta({ uniqueItems: true }).optional(),
};
/** A table's line keeps one language: a text in several is for the page's own fields, and a linked record's shown. */
const oneLanguage = {
  translate: z.never({ error: 'a table’s line keeps its text in one language: a text in several is for the page’s own fields' }).optional(),
  requiredIn: z.never({ error: 'requiredIn is for a text kept in several languages (translate)' }).optional(),
};
type LanguageRules = { translate?: string[]; requiredIn?: string[] };
/** Each language once; `requiredIn` only with `translate`, each of its own — and for tools that read only the JSON Schema, the first. */
const withLanguages = <T extends z.ZodType<LanguageRules>>(schema: T) =>
  schema
    .superRefine((field, context) => {
      const same = (tags: string[]) => tags.find((tag, i) => tags.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) !== i);
      const twice = same(field.translate ?? []);
      if (twice) context.addIssue({ code: 'custom', message: `"${twice}" is named twice: each language once`, path: ['translate'] });
      if (field.requiredIn === undefined) return;
      if (field.translate === undefined) context.addIssue({ code: 'custom', message: 'requiredIn says which of a text’s languages are required: name them in translate', path: ['requiredIn'] });
      else
        field.requiredIn.forEach((tag, i) => {
          if (!field.translate?.some((own) => own.toLowerCase() === tag.toLowerCase())) context.addIssue({ code: 'custom', message: `"${tag}" is not one of the languages it is kept in (translate)`, path: ['requiredIn', i] });
        });
    })
    .meta({ dependentSchemas: { requiredIn: { required: ['translate'] } } });

const charShape = {
  type: z.literal('char'),
  ...common,
  size,
  /** What the whole answer must look like, as a regular expression: tested trimmed, its digits as 0-9 — in each of its languages. */
  pattern: z.string().optional(),
  /** Why an answer does not fit the pattern, in words, in place of "not in the expected format": `{label}` is the field's. */
  patternHint: z.string().min(1).optional(),
    /** A quiz's question (`quiz` on the page): the answers it takes, its points and its feedback. */
    quiz: QuizQuestionSchema.optional(),
};
const textShape = { type: z.literal('text'), ...common, size };
const htmlShape = { type: z.literal('html'), ...common };
/** A page's own text, and a linked record's: kept in one language, or in several (`translate`). */
const Char = withLanguages(z.object({ ...charShape, ...languages }).strict());
const Text = withLanguages(z.object({ ...textShape, ...languages }).strict());
const Html = withLanguages(z.object({ ...htmlShape, ...languages }).strict());
/** A table line's text: one language. */
const LineChar = z.object({ ...charShape, ...oneLanguage }).strict();
const LineText = z.object({ ...textShape, ...oneLanguage }).strict();
const LineHtml = z.object({ ...htmlShape, ...oneLanguage }).strict();
const Integer = z
  .object({ type: z.literal('integer'), ...common, min: z.number().optional(), max: z.number().optional(), quiz: QuizQuestionSchema.optional() })
  .strict();
const Float = z
  .object({ type: z.literal('float'), ...common, min: z.number().optional(), max: z.number().optional(), digits, quiz: QuizQuestionSchema.optional() })
  .strict();
/** The spans of time an amount can be for: a rent's month, a holiday flat's night. */
export const PERIODS = ['day', 'night', 'week', 'month', 'year'] as const;
export type Period = (typeof PERIODS)[number];

/**
 * How an amount is written where it is read rather than typed — a list's
 * cell, a field shown as words, a map's card and pins: its currency by its
 * symbol ("E£", "$": the default) or by its code ("EGP"), before the amount
 * or after it (where the page's language puts it, unless said), short
 * ("13.9M", "13.9 مليون"); the home currency left unsaid, so only another
 * is named; and what the amount is for while a condition holds on the
 * record, the first that holds: "/month" on a rent. Digits stay Latin, as
 * everywhere in Fieldia. Left out, an amount is written as it always was.
 */
export const MoneyLookSchema = z
  .object({
    currency: z.enum(['symbol', 'code']).optional(),
    at: z.enum(['before', 'after']).optional(),
    short: z.boolean().optional(),
    home: z.string().regex(/^[A-Z]{3}$/, 'a home currency is a code of three capitals, such as EGP').optional(),
    per: z
      .array(z.object({ period: z.enum(PERIODS), when: z.string().min(1).optional() }).strict())
      .min(1)
      .optional(),
  })
  .strict()
  .meta({ id: 'MoneyLook' });
export type MoneyLook = z.infer<typeof MoneyLookSchema>;

const Monetary = z
  .object({
    type: z.literal('monetary'),
    ...common,
    /** The field holding this amount's currency; on a line, `parent.` and a field of the record it is on, as Flectra's related currency. */
    currencyField: z.string().regex(/^(parent\.)?[A-Za-z_][A-Za-z0-9_]*$/).optional(),
    /** A fixed ISO 4217 currency, when the page has no currency field. */
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    digits,
    /** How the amount is written where it is read: see `MoneyLookSchema`. */
    money: MoneyLookSchema.optional(),
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
/**
 * A date of a month alone — a billing period, a card's expiry — or of a year alone — a building's year (`precision`):
 * typed and shown as its month ("Oct 2026", 10/2026) or its year (2026), kept as its first day ("2026-10-01",
 * "2026-01-01"), its limits kept by the month or the year. A date with `hijri` is shown and typed in the Hijri calendar
 * (Umm al-Qura) beside the Gregorian day it keeps: "13 Oct 2026 · 1 Rabiʻ II 1448 AH".
 */
const DateField = z
  .object({ type: z.literal('date'), ...common, ...days, precision: z.enum(['month', 'year']).optional(), hijri: z.boolean().optional() })
  .strict()
  .superRefine((field, context) => {
    if (field.precision && field.days) context.addIssue({ code: 'custom', message: 'the days of the week a date may fall on are a day’s: a month or a year has them all', path: ['days'] });
    if (field.precision && field.hijri) context.addIssue({ code: 'custom', message: 'a Hijri date is a day: a month or a year alone is the Gregorian calendar’s', path: ['hijri'] });
  });

/**
 * A time zone by its IANA name: "Africa/Cairo", "Europe/Berlin", "UTC". A page's (`timeZone`) is the zone its dates
 * and times are in; a date and time field may name its own — a flight's departure, in its airport's zone.
 */
export const TimeZoneSchema = z
  .string()
  .regex(/^[A-Za-z][\w+-]*(\/[\w+-]+)*$/, { error: 'a time zone is named as the IANA names it: "Africa/Cairo", "Europe/Berlin", "UTC"', abort: true })
  .refine(isTimeZone, { message: 'not a time zone the IANA names: "Africa/Cairo", "Europe/Berlin", "UTC"' })
  .meta({ id: 'TimeZone', description: 'A time zone by its IANA name: its dates and times are shown and typed on that zone\'s clock.', examples: ['Africa/Cairo', 'Europe/Berlin', 'America/New_York', 'UTC'] });
/**
 * A date and time, kept as an instant. With `timeZone`, it is shown and typed on that zone's clock, and its limits
 * kept by the day it falls on there; else on the page's zone's (`timeZone`), else on the browser's.
 */
const DateTime = z.object({ type: z.literal('datetime'), ...common, ...days, timeZone: TimeZoneSchema.optional() }).strict();
/**
 * Choices the app gives rather than the page: its list by name, loaded through
 * the data source's `options` when the form shows the field, and again when a
 * field named in `dependsOn` changes — a city list that follows the country. A
 * table line's are asked for each line by that line's values — a connection's
 * tools on its own line — and again when a column they change with changes on
 * that line, or, as `parent.` and a field, the record the line is on; lines
 * whose columns hold the same values share one answer.
 */
export const OptionsFromListSchema = z
  .object({
    list: z.string().min(1),
    /**
     * The fields the choices change with: the list is asked again when one does. On a table's line, the line's own
     * columns, or `parent.` and a field of the record it is on.
     */
    dependsOn: z.array(z.string().regex(/^(parent\.)?[A-Za-z_][A-Za-z0-9_]*$/)).min(1).optional(),
  })
  .strict()
  .meta({ id: 'OptionsFromList' });

/**
 * Choices carried from an earlier question of the page: the options picked in it — or, with `picked: false`, those
 * left unpicked — by their labels, then the choice's own options after them ("None of them"). A choice picked here
 * that is no longer picked there is taken out, and the form says so.
 */
export const OptionsFromFieldSchema = z
  .object({
    /** The page's choice they are carried from. */
    field: z.string().regex(FIELD_NAME),
    /** False: the options left unpicked there. */
    picked: z.boolean().optional(),
  })
  .strict()
  .meta({ id: 'OptionsFromField' });

/**
 * Where a choice's options come from besides the page: one of the app's lists (`list`), or an earlier question
 * (`field`). The same for a page's own choice and a table line's; a line's carries none from a question.
 */
export const OptionsFromSchema = z.union([OptionsFromListSchema, OptionsFromFieldSchema]).meta({ id: 'OptionsFrom' });

export type OptionsFrom = z.infer<typeof OptionsFromSchema>;
export type OptionsFromList = z.infer<typeof OptionsFromListSchema>;
export type OptionsFromField = z.infer<typeof OptionsFromFieldSchema>;

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
  .object({
    ...selection,
    options: z.array(SelectionOptionSchema),
    optionsFrom: OptionsFromSchema.optional(),
    /** A quiz's question (`quiz` on the page): its points and its feedback; its right answers are its options marked `correct`. */
    quiz: QuizQuestionSchema.optional(),
  })
  .strict()
  .refine((field) => field.options.length > 0 || field.optionsFrom !== undefined, {
    message: 'a choice needs its options, a list of the app’s to take them from, or an earlier question to carry them from',
    path: ['options'],
  })
  // The same rule for tools that read only the JSON Schema.
  .meta({ anyOf: [{ properties: { options: { minItems: 1 } } }, { required: ['optionsFrom'] }] });
/**
 * A choice in a table's lines: its options written in the page — each may show or hide by a condition on the line's
 * values (`options[].invisible`, `parent.` the record's) — or from one of the app's lists for each line.
 */
const LineSelection = z
  .object({ ...selection, options: z.array(SelectionOptionSchema), optionsFrom: OptionsFromSchema.optional() })
  .strict()
  .refine((field) => field.options.length > 0 || field.optionsFrom !== undefined, {
    message: 'a choice needs its options, or a list of the app’s to take them from',
    path: ['options'],
  })
  .meta({ anyOf: [{ properties: { options: { minItems: 1 } } }, { required: ['optionsFrom'] }] });
/** A choice of a linked record's, shown in a table of them: its options written in the page. */
const LinkedSelection = z.object({ ...selection, options: z.array(OptionSchema).min(1), optionsFrom: z.never({ error: 'choices from the app’s lists are for the page’s own fields and a table’s lines, not a linked record’s' }).optional() }).strict();
/**
 * What a file or an image field takes: the largest file, and whether it holds
 * several — its value then a list of files, as few as `minFiles` and as many
 * as `maxFiles`. How they are shown — a list, thumbnails, or cards with each
 * name under its picture — whether the person filling the form may switch
 * between a list and the pictures, and whether a phone offers its camera, are
 * the layout node's `options` (`files`, `filesSwitch`, `camera`).
 */
/**
 * Photos made smaller before they are kept: the longest side in pixels, and
 * the quality a JPEG or WebP is written at (0.3 to 1). A photo already that
 * small is kept as it is, none is made larger, and its EXIF turn is kept.
 * `false` keeps every photo as it was taken. Where the data source stores
 * files (`upload`), a picture field makes its photos smaller without being
 * told — 2048 pixels at 0.85 — and a file field when this says so.
 */
export const ShrinkSchema = z
  .union([z.literal(false), z.object({ maxSide: z.int().min(160).max(16384).optional(), quality: z.number().min(0.3).max(1).optional() }).strict()])
  .meta({ id: 'Shrink' });
export type Shrink = z.infer<typeof ShrinkSchema>;
const files = {
  /** Largest accepted file, in bytes. */
  maxSize: z.int().positive().optional(),
  /** Photos made smaller before they are kept: see ShrinkSchema. */
  shrink: ShrinkSchema.optional(),
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
const Many2one = z.object({ type: z.literal('many2one'), ...common, relation, filter, createValues }).strict();
/**
 * The fields of the records a many2many links to, for a table of them: its
 * node's `columns` name them, and the data source reads their values. Plain
 * values only — text, numbers, money, yes or no, dates, choices and links.
 * A related list's records' fields are the same (`RelatedNode.fields`).
 */
export const LinkedFieldSchema = z
  .discriminatedUnion('type', [Char, Text, Integer, Float, Monetary, BooleanField, DateField, DateTime, LinkedSelection, Many2one])
  .meta({ id: 'LinkedField' });

export type LinkedField = z.infer<typeof LinkedFieldSchema>;
const Many2many = z
  .object({ type: z.literal('many2many'), ...common, relation, filter, createValues, fields: z.record(z.string().regex(FIELD_NAME), LinkedFieldSchema).optional() })
  .strict();
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

/**
 * Properties whose definitions a linked record keeps — Flectra's
 * `definition_record`: a task's properties are its project's. The app gives
 * them through the data source's `definitions`, by the list's name, when the
 * form shows the field and again when a field named in `dependsOn` (the link)
 * changes; a property added in place goes back through `saveDefinitions`.
 */
export const DefinitionsFromSchema = z
  .object({
    list: z.string().min(1),
    /** The fields the definitions change with, such as the link to the record that keeps them. */
    dependsOn: z.array(z.string().regex(FIELD_NAME)).min(1).optional(),
  })
  .strict()
  .meta({ id: 'DefinitionsFrom' });

export type DefinitionsFrom = z.infer<typeof DefinitionsFromSchema>;

const Properties = z
  .object({
    type: z.literal('properties'),
    ...common,
    /** The properties a record may have. Left out, each property is worked out from its value. */
    definitions: z.array(PropertyDefinitionSchema).optional(),
    /** Definitions the app gives, from the record a link points to: the page's own `definitions` are then left out. */
    definitionsFrom: DefinitionsFromSchema.optional(),
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

/** A field of the lines a line holds: any line field but more lines. */
const InnerLineFieldSchema = z
  .discriminatedUnion('type', [
    LineChar, LineText, LineHtml, Integer, Float, Monetary, BooleanField, DateField, DateTime,
    LineSelection, Binary, Image, Many2one, Many2many, Reference, Properties, Json,
  ])
  .meta({ id: 'InnerLineField' });

/**
 * Lines a line holds, one level down — a survey question's answers: edited
 * in the line's own form (its node's `lineForm`), never drawn inside the
 * table's row, and kept in the line's values as its list of lines.
 */
const LineOne2many = z
  .object({
    type: z.literal('one2many'),
    ...common,
    relation,
    fields: z.record(z.string().regex(FIELD_NAME), InnerLineFieldSchema),
    sequenceField: z.string().regex(FIELD_NAME).optional(),
    /** What a new inner line starts with: each of its fields from an expression over the line that holds it. */
    lineDefaults: valueMap.optional(),
  })
  .strict();

/** A field of a one2many's lines; lines may hold lines of their own, one level down. */
export const LineFieldSchema = z
  .discriminatedUnion('type', [
    LineChar, LineText, LineHtml, Integer, Float, Monetary, BooleanField, DateField, DateTime,
    LineSelection, Binary, Image, Many2one, Many2many, Reference, Properties, Json, LineOne2many,
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
    /** What a new line starts with: each line field from an expression over the record, a field named alone taken whole. */
    lineDefaults: valueMap.optional(),
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
