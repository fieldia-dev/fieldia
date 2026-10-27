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
  /**
   * Whether a page in the current format relies on what this format brought that its settings do not show — a default
   * this format changed, left unset — so it needs this format at the least (`lowestFormat`). A step that writes the old
   * default into older pages says it; one that only renames needs none.
   */
  uses?(page: PageJson): boolean;
}

/**
 * Every step of the format so far, oldest first. None yet: 0.2 (Fieldia 0.22) only added — a calendar's settings, a
 * date's order, a pattern's hint, a photo's `shrink` — so a 0.1 page is a 0.2 page as it is; and 0.3 (Fieldia 0.24)
 * only added too — a page's and a date and time's `timeZone`, its `phone` and a phone field's options, booking slots'
 * options, a list's totals, periods, `export` and `bulkEdit`, a box's `autocomplete` and `inputmode`, a page's
 * `botCheck` — so a 0.2 page is a 0.3 page as it is; and 0.4 (Fieldia 0.25) only added as well — a record's `related`
 * lists, a list's `card`, `gallery`, `optionalColumns`, `rowTones`, `rowBold`, `rowButtons`, `import` and `print`, a
 * page's `print` and `duplicates`, the `print` step and the built-in Print — so a 0.3 page is a 0.4 page as it is;
 * and 0.5 (Fieldia 0.26) only added again — a page's `records` and `lowerLabels`, a tab's count of a related list in it
 * (`count: { related }`, beside a field's name), a related list's `open`, a node's `print: false`, a row tone's `label`
 * and a list's `rowBoldLabel` — so a 0.4 page is a 0.5 page as it is; and 0.6 (Fieldia 0.27) only added once more — a
 * page's `endings`, `limits` and `continueLater`, an option's `seats` and `invisible`, `optionsFrom` carried from a
 * question (`{ field, picked }`) and on a table's line, a signature's `signs` and `signerField`, a list's
 * `filterRanges`, `filterCounts` and `filterSheet`, `{field}` words in a page's words — so a 0.5 page is a 0.6 page as
 * it is; 0.7 (Fieldia 0.28) only added — a table of lines' `cards: "never"`, its rows kept at a phone's width — so a
 * 0.6 page is a 0.7 page as it is; and 0.8 (Fieldia 0.29) only added — a record's `approval`, a list's `editable` and
 * `searchToFilter`, a text's `translate` and `requiredIn`, a page's `suggest`, a text field's `options.rewrite`, a
 * photo set's options and a field's `options.scan` — so a 0.7 page is a 0.8 page as it is; and 0.9 (Fieldia 0.30) only
 * added — a menu item's `type: "divider"`, its own `menu` and `menuFrom`, a formatted text's `options.edit` — so a 0.8
 * page is a 0.9 page as it is; and 0.10 (Fieldia 0.31) only added — a list's `detail`, `sequenceField`, `endless`,
 * `loadChildren` and `gantt`, a date's `precision` and `hijri`, an option's `caption`, `icon` and `color`, a page's
 * `quiz`, `review`, `flow`, `timeLimit`, `prefill`, `payment`, `outbox` and `templates`, a question's own `quiz`, a
 * step's and a group's `order`, `draw` and `fixed`, a button's `undo` — so a 0.9 page is a 0.10 page as it
 * is (and 0.10 is after 0.9: versions compare as numbers, `compareFormats`); and 0.11 (Fieldia 0.32) only added — how a
 * phone's country is picked, a page's `phone.countries` and a phone field's `options.countries` ("list" or "native") —
 * so a 0.10 page is a 0.11 page as it is; and 0.12 (Fieldia 0.33) only added — how a page waits, its `loading` (each
 * moment's way, its looks, its timing, a failure's way), on the page, a list, a related list and a map, and a field's
 * `options.loading` — so a 0.11 page is a 0.12 page as it is; and 0.13 (Fieldia 0.34) only added — a field's `secret`,
 * never kept in a draft — so a 0.12 page is a 0.13 page as it is (0.34's other checks — a field named `constructor`,
 * `__proto__` or `prototype`, a pattern that could take seconds — are refusals of what a page says, not its shape).
 * A release that renames or reshapes a setting adds a step here, with its example; one that only adds needs
 * none: the page is the same, and upgradePage writes the new version in it. From 0.36 a default that changes is a new
 * format too: its step writes the old default into an older page, so it keeps doing what it did, and says which pages
 * rely on the new one (`uses`), so `lowestFormat` stamps them with it. A page is saved in the lowest format it needs
 * (stamp.ts), read from the format's history (tools/format-since.mjs): once a format is released, run it.
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
 *
 * It is the door every reader of a page comes through — `checkPage`, `validatePage`, `createForm`, the designer — and so
 * where a choice that writes no `options` is read as having none (`options: []`): one whose options come from the app's
 * list (`optionsFrom`) is drawn, and the list fills them, as 0.13 drew it. Every choice in a map of fields the page
 * holds: its own, its lines' and links', the fields a list or a related list shows. The page given is never changed;
 * where no choice leaves its options out, the page is handed back as said above.
 */
export function upgradePage<T>(page: T, history: FormatHistory = { versions: FORMAT_VERSIONS, steps: PAGE_UPGRADES }): T {
  return choicesRead(upTo(page, history)) as T;
}

/**
 * A part of a page with each choice in a map of fields by name (`fields`, at any depth) that writes no options read as
 * having none: the part itself where none does. `fields`: the part is such a map, each entry a field, of which only its
 * own options and its own map of fields (a table's lines', a link's) are read — its values and words are not walked.
 */
function choicesRead(part: unknown, fields = false): unknown {
  let out: Record<string, unknown> | null = null;
  for (const key in part as object) {
    const inner = (part as Record<string, PageJson>)[key];
    if (inner === null || typeof inner !== 'object') continue;
    let read = fields ? inner : (choicesRead(inner, key === 'fields' && isObject(inner)) as PageJson);
    if (fields) {
      const own = choicesRead(inner['fields'], isObject(inner['fields']));
      if (own !== inner['fields']) read = { ...read, fields: own };
      if (inner['type'] === 'selection' && !Array.isArray(inner['options'])) read = { ...read, options: [] };
    }
    if (read !== inner) (out ??= (Array.isArray(part) ? [...part] : { ...(part as object) }) as Record<string, unknown>)[key] = read;
  }
  return out ?? part;
}

/** The page brought up to its current format, by the steps above. */
function upTo<T>(page: T, history: FormatHistory): T {
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
