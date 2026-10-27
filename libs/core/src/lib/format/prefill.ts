import * as z from 'zod';
import { FIELD_NAME } from './names';

/**
 * A link's parameter that fills a field as the page opens: the field of its own name, or another (`field`) — a
 * campaign's `utm_source` into `source`, a broker's `agent` into `agent_code`.
 */
export type PrefillParam =
  | string
  | {
      /** The link's parameter, by its name: `agent`. */
      param: string;
      /** The field it fills: `agent_code`. */
      field: string;
    };

/**
 * Fields filled from the link a page is opened with (`prefill` on a page): a campaign's, a broker's, a listing's —
 * `?utm_source=whatsapp&agent=mona&unit=B-12` — with no code of the app's. Each parameter named fills the field of its
 * name, or the `field` it names, as the form starts (a new record, a response, and each started again with Submit
 * another), read as that field reads words: a number as a number, a yes or no, a choice by one of its options' values,
 * a day as 2026-10-20; one that does not read so is left out, never guessed. What the person types afterwards is
 * theirs, and a draft opened over it is too: the link never writes over an answer.
 *
 *   "prefill": { "fromUrl": ["utm_source", "utm_campaign", { "param": "agent", "field": "agent_code" }] }
 *
 * A field the page fills so and places nowhere is a hidden field: sent with the answers all the same (a page of
 * responses sends only what its questions show, and these besides), seen by no one. One placed on the page shows the
 * value the link gave, for the person to keep or change.
 */
export interface PagePrefill {
  /** The link's parameters, by name, each filling the field of its name — or `{ param, field }` where the two differ. */
  fromUrl: PrefillParam[];
}

const PARAM = /^[A-Za-z0-9_.~-]{1,100}$/;

export const PagePrefillSchema = z
  .strictObject({
    fromUrl: z
      .array(
        z.union([
          z.string().regex(FIELD_NAME, { error: 'a parameter named alone fills the field of its name: a field’s name ("utm_source"), or { "param": …, "field": … }' }),
          z.strictObject({
            param: z.string().regex(PARAM, { error: 'a link’s parameter is letters, digits and _ . ~ -, at most 100' }),
            field: z.string().regex(FIELD_NAME),
          }),
        ])
      )
      .min(1, { error: 'name at least one parameter of the link' }),
  })
  .meta({ id: 'PagePrefill' });
