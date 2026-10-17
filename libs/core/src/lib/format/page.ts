import * as z from 'zod';
import { PageEventsSchema, type PageEvents } from './actions';
import { FieldsSchema, TimeZoneSchema, type Fields } from './field';
import { HelpShownSchema, RootLayoutSchema, type HelpShown, type RootLayout } from './layout';
import { PART_LOOKS, type PartLook, type PartsLook } from './part-look';
import { PagePhoneSchema, type PagePhone } from './phone';
import { PageDuplicatesSchema, type PageDuplicates } from './duplicates';
import { PageRecordsSchema, type PageRecords } from './records';
import { THEMES, type Theme } from './themes';
export { THEMES, type Theme } from './themes';
import { SKINS, type Skin } from './themes';

import { FORMAT_VERSIONS, formatProblem, type FormatVersion } from './version';
import type { DateOrder } from '../record/input-rules';
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
  /** A theme in the style of a known design system: see `THEMES`. The settings below win over it. */
  theme?: Theme;
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
  /**
   * Where a field's help shows across the page, unless a field says otherwise:
   * as words under it (the default), behind a (?) beside its label — Flectra's
   * tooltip, which keeps a dense sheet short — or both.
   */
  helpShown?: HelpShown;
  /**
   * Where a field locked by a rule shows its lock: by its label (the default),
   * or at its value's start, as a work item shows Reason's — in a record
   * head's band, in the room before the value.
   */
  lockAt?: 'label' | 'value';
  /**
   * How a read-only field shows: as its value in words, as Flectra draws one
   * — a choice without its arrow, a long text wrapped, an amount with its
   * currency, a link's name — or in its greyed box (the default). A yes or
   * no, a table, tags, a file and the like keep their own look either way.
   */
  readonlyShown?: 'text' | 'box';
  /**
   * False: an empty field in the quiet look shows nothing at rest, as a work
   * item's Planning does, its label saying what it is; true (the default) it
   * says what to add ("Add story points").
   */
  quietHints?: boolean;
  /** Light, dark, or as the reader's system has it. */
  scheme?: 'light' | 'dark' | 'auto';
  /** A look for each kind of part, over the page's: text boxes, choices, groups, buttons, tables. See `PART_LOOKS`. */
  parts?: PartsLook;
  /**
   * The skin the form is drawn in, unless the app's viewer names one: `quiet`
   * draws each value as plain words until it is pointed at or entered; a
   * section or a field can be quiet on its own instead (`quiet`). A theme's
   * own skin when left out (see `SKINS`).
   */
  skin?: Skin;
  /**
   * The order a date is typed in, and shown in while it is typed: day, month, year (`dmy`, the default, as
   * English, Arabic, French and German pages write dates), month first (`mdy`), or year first (`ymd`). A date
   * written year first, 2026-10-13, is read whatever the order.
   */
  dateOrder?: DateOrder;
}

/**
 * A public page's check that a person, not a bot, sends it (a page of responses only). Nothing is refused for it:
 * each send tells the app what it saw (`SubmitRequest.bot`), and the app decides.
 */
export interface BotCheck {
  /**
   * A box no person sees, reaches with Tab or hears read out, which a bot filling every box fills: told as
   * `honeypot`. On unless false.
   */
  honeypot?: boolean;
  /** The fewest seconds a person takes from the page shown to its send: sooner is told as `tooFast`. 3 unless said; 0 tells none. */
  minSeconds?: number;
  /**
   * The slot the app draws its captcha in (Turnstile, reCAPTCHA, hCaptcha), by its name, as a slot part of the page
   * names it: the app's widget gives its token to the form (`form.botCheck({ captcha })`), and the send carries it.
   */
  captcha?: string;
}

/**
 * What a printout of the page carries besides the page itself, at its top and its foot: the app's logo and words
 * over every printout — a company's name and address — and words under it — its terms, a bank account. Each `{field}`
 * shows that field's value, as a text part's words do. Every page prints, with or without it: every tab, step and
 * folded section, the values as words, the record's title and the day printed at the top.
 */
export interface PagePrint {
  /** Words at the top of the printout, beside the logo: "Nile Traders · 12 Corniche St, Cairo". */
  header?: string;
  /** Words at its foot: "Paid within 30 days to CIB, IBAN EG38 0019 …". */
  footer?: string;
  /** The app's logo, by its address (`https://…`, `/logo.svg`, `data:image/…`): at the top, before the header's words. */
  logo?: string;
}

export interface Page {
  /**
   * The format the page is written in, so a reader can tell one it cannot read yet (a newer Fieldia's) from one it can
   * bring up to date (an older one's: `upgradePage`). A page made now says FORMAT_VERSION.
   */
  fieldia: FormatVersion;
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
  /** A page of responses open to anyone: a check that a person sends it, told to the app with the answers. */
  botCheck?: BotCheck;
  /**
   * Its phone fields (`"widget": "phone"`) read and kept as one number the world over: typed at home or with their +,
   * checked by their country, kept as E.164 ("+201012345678"), shown at rest as `shown` says, with a call and a
   * WhatsApp link. `country` is the one a number typed without its + is read in — never assumed when left out. A field
   * says otherwise in its `options`. Without it (and without those options), a phone field is a text box, as before.
   */
  phone?: PagePhone;
  /**
   * The time zone the page's dates and times are in, by its IANA name: a branch's, a clinic's ("Africa/Cairo"). A date
   * and time is then shown and typed on that zone's clock — its short name beside it where the browser's zone is
   * another ("14:30 EEST") — and kept as the instant it is. Today is that zone's day: a date's default "today", its
   * earliest and latest counted from today, `today()`, a booking's days. A date and time field may name its own
   * (`timeZone`). Left out, the browser's own zone, as before.
   */
  timeZone?: string;
  /** What a printout of the page carries at its top and its foot: the app's logo and words over it, words under it. */
  print?: PagePrint;
  /**
   * Possible duplicates, on a record's page: the fields records like this one are found by — the same phone, email or
   * id, a name close enough — asked of the data source's `duplicates` while a person types in them (`on: "type"`, the
   * default; and as a saved record is opened) and again as the record is saved, or only then (`on: "save"`). Each match
   * is said under the field it matched on, with Open it, "It's someone new" and, where the source has `merge`, Merge.
   * Never in the way of a save. Without the source's `duplicates`, nothing is asked and nothing shows.
   */
  duplicates?: PageDuplicates;
  /**
   * What its records are called, so Fieldia's sentences name them: "A customer with this phone already exists", "17
   * customers imported", "New customer" — `one`, `other` and, where its language puts an article before one, `a` ("an
   * invoice"); `lowerLabels` writes a field's label inside those sentences with a small letter ("this phone"). Other
   * languages through `translations`. Left out, "record", as before. See `PageRecords`.
   */
  records?: PageRecords;
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
    // Newer than this Fieldia, or no format at all: said in words (formatProblem), not as a literal expected.
    // Any format Fieldia has had: a page is brought up to date before it is checked, and an app's own older pages
    // ("0.1", from 0.20 and 0.21) still type as pages.
    fieldia: z.enum(FORMAT_VERSIONS, { error: (issue) => formatProblem(issue.input) ?? undefined }),
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
        theme: z.enum(THEMES).optional(),
        accent: COLOUR.optional(),
        font: z.enum(['system', 'serif', 'rounded']).optional(),
        density: z.enum(['compact', 'comfortable', 'roomy']).optional(),
        corners: CORNERS.optional(),
        labels: z.enum(['above', 'beside', 'hidden']).optional(),
        labelWidth: z.int().min(60).max(320).optional(),
        helpShown: HelpShownSchema.optional(),
        lockAt: z.enum(['label', 'value']).optional(),
        readonlyShown: z.enum(['text', 'box']).optional(),
        quietHints: z.boolean().optional(),
        scheme: z.enum(['light', 'dark', 'auto']).optional(),
        parts: PartsLookSchema.optional(),
        skin: z.enum(SKINS).optional(),
        dateOrder: z.enum(['dmy', 'mdy', 'ymd']).optional(),
      })
      .optional(),
    language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).optional(),
    translations: z.record(z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/), z.record(z.string(), z.string())).optional(),
    on: PageEventsSchema.optional(),
    botCheck: z
      .strictObject({
        honeypot: z.boolean().optional(),
        minSeconds: z.number().min(0).max(3600).optional(),
        captcha: z.string().min(1).optional(),
      })
      .meta({ id: 'BotCheck' })
      .optional(),
    phone: PagePhoneSchema.optional(),
    timeZone: TimeZoneSchema.optional(),
    print: z
      .strictObject({
        header: z.string().min(1).max(500).optional(),
        footer: z.string().min(1).max(1000).optional(),
        // An address an image is drawn from: the web's, the app's own (a path), or the picture itself — never a script's.
        logo: z
          .string()
          .regex(/^(https?:\/\/|data:image\/|\/|\.{0,2}\/?[^:\s]+$)/i, { error: 'a logo is an image’s address: https://…, a path, or data:image/…' })
          .optional(),
      })
      .meta({ id: 'PagePrint' })
      .optional(),
    duplicates: PageDuplicatesSchema.optional(),
    records: PageRecordsSchema.optional(),
  })
  .meta({
    title: 'Fieldia page',
    description:
      'A form, survey or record screen as data. This schema checks shape; validatePage() also checks that every reference resolves.',
  });
