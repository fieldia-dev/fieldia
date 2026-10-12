import type { Locale } from '@fieldia/core';

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
const words = (piece: string) => piece.toLowerCase().split(/\s+/);
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
  return kept.join(locale === 'ar' ? '، ' : ', ');
}
