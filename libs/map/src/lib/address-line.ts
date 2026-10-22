import type { Locale } from '@fieldia/core';
import { listComma } from '@fieldia/core';

/**
 * An address on one line, as a field keeps it and a suggestion's second line
 * shows it: its pieces in order (a name or a street, then where it is), each
 * said once, joined as the page's language joins them, "، " in Arabic and
 * ", " in the others. A piece is cut where a provider put its own commas, and
 * left out when it repeats one said before it: the same words ("Cairo",
 * "Cairo"), or a wider place named after it ("Cairo Governorate" after
 * "Cairo", "محافظة القاهرة" after "القاهرة") unless it carries a number of
 * its own, a postcode. A narrower piece holding a wider one's name, a street
 * named after its city, stays: it was said first.
 */

const MARKS = /[‎‏؜‪-‮⁦-⁩]/g;
/** A piece's words as compared: without the tatweel and the vowel marks Arabic may carry ("الشيـخ" is "الشيخ"). */
const words = (piece: string) => piece.replace(/\p{Mn}|\u0640/gu, '').toLowerCase().split(/\s+/);
/** Whether `few` are in `many`, one after another, as whole words. */
const within = (few: string[], many: string[]) => many.some((_, at) => few.every((word, i) => many[at + i] === word));

/** Its pieces, cut where the provider put commas, without the marks it put in Arabic. */
const cut = (pieces: unknown[]) => pieces.flatMap((p) => (typeof p === 'string' ? p.replace(MARKS, '').split(/[,،]/) : [])).map((piece) => piece.trim()).filter(Boolean);

/** `before`: what is said already, on a line above (a suggestion's name), and not said again. */
export function addressLine(pieces: unknown[], locale?: Locale, before: unknown[] = []): string {
  const said = cut(before).map(words);
  const kept: string[] = [];
  for (const text of cut(pieces)) {
    const these = words(text);
    if (said.some((earlier) => within(earlier, these) && (earlier.length === these.length || !/\p{Nd}/u.test(text)))) continue;
    said.push(these);
    kept.push(text);
  }
  return kept.join(listComma(locale ?? 'en'));
}

/** Letters written right to left: Arabic's and Hebrew's. */
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * The direction most of a text's letters are written in, for a box or a
 * line that shows an address in its own words: "rtl" for one mostly in
 * Arabic, though it starts with a Latin street ("El Tahrir، الإسماعيلية،
 * مصر"), "ltr" for one mostly in Latin on an Arabic page ("1 Mohammed
 * Mahmoud"); "" when there are no letters, or as many each way: the page's.
 */
export function directionOf(text: string): 'ltr' | 'rtl' | '' {
  const letters = text.match(/\p{L}/gu) ?? [];
  const rtl = letters.filter((letter) => RTL.test(letter)).length;
  const ltr = letters.length - rtl;
  return rtl > ltr ? 'rtl' : ltr > rtl ? 'ltr' : '';
}
