/**
 * Every `Intl` formatter Fieldia writes with, made once for a language and its options and kept: a date field's month
 * and its days, a cell's money, a list's counts, a calendar's weekday heads. Making one costs a hundred times what
 * using it does — at 0.32, made anew in each cell and each keystroke, they were a quarter of the work of a table of
 * 200 lines and of an editable list's first draw (the performance audit's M1). The one place Fieldia makes them: a
 * source rule refuses `new Intl.…` anywhere else (tools/intl-source.test.mjs).
 *
 * What it makes behaves as the constructor's would: one that refuses its language or options (an unknown time zone, a
 * currency that is no code) throws as the constructor does, every time, and nothing is kept for it.
 */
interface IntlKinds {
  DateTimeFormat: [Intl.DateTimeFormatOptions, Intl.DateTimeFormat];
  NumberFormat: [Intl.NumberFormatOptions, Intl.NumberFormat];
  PluralRules: [Intl.PluralRulesOptions, Intl.PluralRules];
  ListFormat: [Intl.ListFormatOptions, Intl.ListFormat];
  RelativeTimeFormat: [Intl.RelativeTimeFormatOptions, Intl.RelativeTimeFormat];
  DisplayNames: [Intl.DisplayNamesOptions, Intl.DisplayNames];
  Collator: [Intl.CollatorOptions, Intl.Collator];
}

/** The kinds of formatter `intlFormat` makes: Intl's constructor of each name. */
export type IntlKind = keyof IntlKinds;

/** At most this many kept of a kind: a page's languages, currencies and zones are a few; past it, they are made anew. */
const KEPT = 500;
/** Kept by the constructor that made them: a polyfill put in Intl's place later (or a test's) makes its own. */
const made = new Map<unknown, Map<string, unknown>>();

/**
 * Intl's formatter of a kind for a language (or a list of them; none is the browser's) and options: the same object
 * for the same three, made the first time they are asked for.
 */
export function intlFormat<K extends IntlKind>(kind: K, locale?: string | readonly string[], options?: IntlKinds[K][0]): IntlKinds[K][1] {
  const Made = Intl[kind] as unknown as new (locale?: string | readonly string[], options?: IntlKinds[K][0]) => IntlKinds[K][1];
  let kept = made.get(Made);
  if (!kept) made.set(Made, (kept = new Map()));
  // No language is "undefined", which no tag is; no options too, which no options' JSON is.
  const key = `${String(locale)} ${JSON.stringify(options)}`;
  let found = kept.get(key) as IntlKinds[K][1] | undefined;
  if (!found) {
    found = new Made(locale, options);
    if (kept.size >= KEPT) kept.clear();
    kept.set(key, found);
  }
  return found;
}
