import * as z from 'zod';
import { PageEventsSchema, type PageEvents } from './actions';
import { FieldsSchema, type Fields } from './field';
import { RootLayoutSchema, type RootLayout } from './layout';
import { PART_LOOKS, type PartLook, type PartsLook } from './part-look';

import { FORMAT_VERSION } from './version';
export { FORMAT_VERSION } from './version';

/**
 * Where a page's values go. A `record` page edits records of a model through
 * the app's data source; a `responses` page collects one new response per
 * submission, the way a survey does.
 */
export type PageData = { kind: 'record'; model: string } | { kind: 'responses' };

/**
 * How the page looks: these become the form's own tokens, so every widget
 * follows them and a dark scheme keeps working.
 */
export interface PageLook {
  /** The accent: buttons, focus, the picked tab, a band under the title. `#rrggbb`. */
  accent?: string;
  font?: 'system' | 'serif' | 'rounded';
  /** Room between and inside parts: compact for long office forms, roomy for a short public form. */
  density?: 'compact' | 'comfortable' | 'roomy';
  corners?: 'square' | 'soft' | 'round';
  /** Where labels sit across the page, unless a section or a field says otherwise. */
  labels?: 'above' | 'beside' | 'hidden';
  /** How wide labels set beside their boxes are, in pixels. */
  labelWidth?: number;
  /** Light, dark, or as the reader's system has it. */
  scheme?: 'light' | 'dark' | 'auto';
  /** A look for each kind of part, over the page's: text boxes, choices, groups, buttons, tables. See `PART_LOOKS`. */
  parts?: PartsLook;
}

export interface Page {
  /** The format version, so a reader can refuse what it does not understand. */
  fieldia: typeof FORMAT_VERSION;
  id: string;
  title?: string;
  description?: string;
  data: PageData;
  fields: Fields;
  layout: RootLayout;
  /** How wide the page goes: narrow 640px, medium 900px, wide 1180px, full the whole width. */
  maxWidth?: 'narrow' | 'medium' | 'wide' | 'full';
  /** Where Save and Discard sit: at the top of the page, or at its foot. A wizard keeps its own. */
  actionsPosition?: 'top' | 'bottom';
  look?: PageLook;
  /** The language the page's own words are written in, by language tag. English unless said. */
  language?: string;
  /**
   * The page's words in other languages, by language tag (`ar`, `fr`,
   * `pt-BR`): each a map from the words as written to their translation.
   * Words with no translation show as written. See `localizePage`.
   */
  translations?: { [locale: string]: { [text: string]: string } };
  /** What the form does at its moments — opened, a field changed, before and after saving, a step shown: steps, as data. */
  on?: PageEvents;
}

export const PageDataSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('record'), model: z.string().min(1) }),
  z.strictObject({ kind: z.literal('responses') }),
]);

const COLOUR = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const CORNERS = z.enum(['square', 'soft', 'round']);
const PART_SETTING: { [K in keyof Required<PartLook>]: z.ZodType } = {
  background: COLOUR,
  border: COLOUR,
  corners: CORNERS,
  textSize: z.enum(['small', 'large']),
  accent: COLOUR,
};
/** Each kind of part with only the settings it can draw. */
const PartsLookSchema = z.strictObject(
  Object.fromEntries(
    Object.entries(PART_LOOKS).map(([kind, settings]) => [kind, z.strictObject(Object.fromEntries(settings.map((name) => [name, PART_SETTING[name].optional()]))).optional()])
  )
);

export const PageSchema = z
  .strictObject({
    fieldia: z.literal(FORMAT_VERSION),
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    title: z.string().optional(),
    description: z.string().optional(),
    data: PageDataSchema,
    fields: FieldsSchema,
    layout: RootLayoutSchema,
    maxWidth: z.enum(['narrow', 'medium', 'wide', 'full']).optional(),
    actionsPosition: z.enum(['top', 'bottom']).optional(),
    look: z
      .strictObject({
        accent: COLOUR.optional(),
        font: z.enum(['system', 'serif', 'rounded']).optional(),
        density: z.enum(['compact', 'comfortable', 'roomy']).optional(),
        corners: CORNERS.optional(),
        labels: z.enum(['above', 'beside', 'hidden']).optional(),
        labelWidth: z.int().min(60).max(320).optional(),
        scheme: z.enum(['light', 'dark', 'auto']).optional(),
        parts: PartsLookSchema.optional(),
      })
      .optional(),
    language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).optional(),
    translations: z.record(z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/), z.record(z.string(), z.string())).optional(),
    on: PageEventsSchema.optional(),
  })
  .meta({
    title: 'Fieldia page',
    description:
      'A form, survey or record screen as data. This schema checks shape; validatePage() also checks that every reference resolves.',
  });
