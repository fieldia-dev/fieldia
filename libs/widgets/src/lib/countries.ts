/**
 * Every country, by its code and its name in the page's language. An address's
 * country list draws from it (address.ts, in the survey part), and so do what
 * stays in the main script: an address shown plainly before its part came,
 * the designer's country setting and the map's address search.
 */
import { intlFormat } from '@fieldia/core';

/** Codes with a region's name that are no country: old ones, groups, and the like. */
const NOT_COUNTRIES = 'AC AN BU CP CQ CS DD DG DY EA EU EZ FX HV IC NH QO RH SU TA TP UK UN VD XA XB YD YU ZR ZZ';
const countries: Record<string, [string, string][]> = {};
/** Every country, by its code and its name in the language, in the language's order. */
export function countriesIn(locale: string): [string, string][] {
  if (!countries[locale]) {
    const names = intlFormat('DisplayNames', [locale], { type: 'region', fallback: 'none' });
    const found: [string, string][] = [];
    for (let a = 65; a < 91; a++)
      for (let b = 65; b < 91; b++) {
        const code = String.fromCharCode(a, b);
        const name = !NOT_COUNTRIES.includes(code) && names.of(code);
        if (name) found.push([code, name]);
      }
    countries[locale] = found.sort((x, y) => intlFormat('Collator', locale).compare(x[1], y[1]));
  }
  return countries[locale];
}
