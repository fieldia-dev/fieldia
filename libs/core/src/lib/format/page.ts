import * as z from 'zod';
import { FieldsSchema, type Fields } from './field';
import { RootLayoutSchema, type RootLayout } from './layout';

/** The page format version this build reads and writes. */
export const FORMAT_VERSION = '0.1' as const;

/**
 * Where a page's values go. A `record` page edits records of a model through
 * the app's data source; a `responses` page collects one new response per
 * submission, the way a survey does.
 */
export type PageData = { kind: 'record'; model: string } | { kind: 'responses' };

export interface Page {
  /** The format version, so a reader can refuse what it does not understand. */
  fieldia: typeof FORMAT_VERSION;
  id: string;
  title?: string;
  description?: string;
  data: PageData;
  fields: Fields;
  layout: RootLayout;
}

export const PageDataSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('record'), model: z.string().min(1) }),
  z.strictObject({ kind: z.literal('responses') }),
]);

export const PageSchema = z
  .strictObject({
    fieldia: z.literal(FORMAT_VERSION),
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    title: z.string().optional(),
    description: z.string().optional(),
    data: PageDataSchema,
    fields: FieldsSchema,
    layout: RootLayoutSchema,
  })
  .meta({
    title: 'Fieldia page',
    description:
      'A form, survey or record screen as data. This schema checks shape; validatePage() also checks that every reference resolves.',
  });
