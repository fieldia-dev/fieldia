/** A Latin letter: what CLDR gives as a narrow day where a language has none of its own. */
import { intlFormat } from '@fieldia/core';
const LATIN = /\p{Script=Latin}/u;

/**
 * A day of the week as a calendar's column heads it: its short name ("Mon", "lun", "Mo"), or — where the short names
 * are whole words, as Arabic's are (الاثنين) — its narrow one (ن), which fits the column; one or the other for the
 * whole week. Always in the language's own script: where CLDR gives a language no narrow days of its own it gives
 * English's letters (Urdu's S M T W T F S), and the short names head the columns then. The head's `abbr` says the day
 * whole. The date part's; booking slots take it from there.
 */
export function weekdayHead(lang: string): (day: Date) => string {
  let found = heads.get(lang);
  if (!found) heads.set(lang, (found = headOf(lang)));
  return found;
}

/** Each language's, worked out the first time a calendar in it opens: the same for every calendar. */
const heads = new Map<string, (day: Date) => string>();
function headOf(lang: string): (day: Date) => string {
  const short = intlFormat('DateTimeFormat', lang, { weekday: 'short' });
  const narrow = intlFormat('DateTimeFormat', lang, { weekday: 'narrow' });
  const name = (day: Date) => short.format(day).replace(/\.$/, '');
  // A week from Sunday 7 January 2024.
  const week = [7, 8, 9, 10, 11, 12, 13].map((d) => new Date(2024, 0, d));
  const letters = week.some((day) => [...name(day)].length > 4) && !week.some((day) => LATIN.test(narrow.format(day)) && !LATIN.test(name(day)));
  return (day) => (letters ? narrow.format(day) : name(day));
}
