import { compareFormats, FORMAT_VERSIONS } from './version';

/** A page as JSON, before it is known to be in the current format. */
export type PageJson = { [key: string]: unknown };

/** One step of the format's history: how a page in the format before `to` is rewritten into `to`'s shape. */
export interface PageUpgrade {
  /** The format the step brings a page to. */
  to: string;
  /** What changed, in plain words, for the docs and the changelog: "A field's caption is its label." */
  changes: string;
  /** The page — a copy of its own, in the format before — rewritten into `to`'s shape. Its `fieldia` is set after. */
  upgrade(page: PageJson): PageJson;
  /** A page before the step and after it. upgrade.spec.ts runs every step on its example: none goes untested. */
  example: { before: PageJson; after: PageJson };
}

/**
 * Every step of the format so far, oldest first. None yet: 0.2 (Fieldia 0.22) only added — a calendar's settings, a
 * date's order, a pattern's hint, a photo's `shrink` — so a 0.1 page is a 0.2 page as it is; and 0.3 (Fieldia 0.24)
 * only added too — a page's and a date and time's `timeZone`, its `phone` and a phone field's options, booking slots'
 * options, a list's totals, periods, `export` and `bulkEdit`, a box's `autocomplete` and `inputmode`, a page's
 * `botCheck` — so a 0.2 page is a 0.3 page as it is; and 0.4 (Fieldia 0.25) only added as well — a record's `related`
 * lists, a list's `card`, `gallery`, `optionalColumns`, `rowTones`, `rowBold`, `rowButtons`, `import` and `print`, a
 * page's `print` and `duplicates`, the `print` step and the built-in Print — so a 0.3 page is a 0.4 page as it is. A
 * release that renames or reshapes a setting adds a step here, with its example; one that only adds needs none: the
 * page is the same, and upgradePage writes the new version in it.
 */
export const PAGE_UPGRADES: readonly PageUpgrade[] = [];

/** The formats and the steps between them that a page is brought up through. Fieldia's own unless a test gives others. */
export interface FormatHistory {
  versions: readonly string[];
  steps: readonly PageUpgrade[];
}

const isObject = (value: unknown): value is PageJson => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * A page in the current format. One already in it is handed back as it is (the same object). One in an older format
 * Fieldia has had is copied and brought up to date step by step — each step after the page's own format, in order —
 * and says the current format in `fieldia`; the page given is never changed. With no step to take (formats that only
 * added), the copy is the page's own top level: its fields, layout and the rest are the very objects given. A page newer than this Fieldia, or of a
 * format it never had, is handed back as it is, for the checks to say what is wrong with it.
 *
 * `checkPage` and `validatePage` do this first, and so the viewer and the designer read an older page as a current one.
 * An app that stores pages can upgrade them as it loads them, and write them back in the current format.
 */
export function upgradePage<T>(page: T, history: FormatHistory = { versions: FORMAT_VERSIONS, steps: PAGE_UPGRADES }): T {
  if (!isObject(page)) return page;
  const from = page['fieldia'];
  const current = history.versions[history.versions.length - 1];
  if (from === current || typeof from !== 'string' || !history.versions.includes(from)) return page;
  const steps = history.steps.filter((step) => (compareFormats(step.to, from) ?? 0) > 0 && (compareFormats(step.to, current) ?? 1) <= 0);
  // Formats that only added (0.1 to 0.2): the page is the same but for its version, and keeps its own fields, layout
  // and everything in them — an app's field objects stay the ones the form holds.
  if (!steps.length) return { ...page, fieldia: current } as T;
  let next = JSON.parse(JSON.stringify(page)) as PageJson;
  for (const step of steps) next = { ...step.upgrade(next), fieldia: step.to };
  return { ...next, fieldia: current } as T;
}
