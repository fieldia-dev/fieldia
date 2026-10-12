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

export function addressLine(pieces: unknown[], locale?: Locale): string {
  const said: string[][] = [];
  const kept: string[] = [];
  for (const piece of pieces.flatMap((p) => (typeof p === 'string' ? p.replace(MARKS, '').split(/[,،]/) : []))) {
    const text = piece.trim();
    if (!text) continue;
    const these = words(text);
    if (said.some((before) => within(before, these) && (before.length === these.length || !/\p{Nd}/u.test(text)))) continue;
    said.push(these);
    kept.push(text);
  }
  return kept.join(locale === 'ar' ? '، ' : ', ');
}
