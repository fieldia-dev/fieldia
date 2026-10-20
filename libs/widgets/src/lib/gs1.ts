/**
 * A GS1 code's parts (the scan part): the element strings a GS1 DataMatrix, a GS1 QR code or a GS1-128 barcode
 * carries — a medicine's or a device's GTIN (01), its batch or lot (10), its expiry (17), its serial number (21) — as
 * a scanner reads them: after a symbology identifier (`]d2`, `]Q3`, `]C1`) or an FNC1 the reader gives as the group
 * separator, each part by its Application Identifier, a part of no fixed length ended by a group separator or by the
 * code's end. Written as people print them — "(01)06285096000842(17)281231(10)25A1234" — they read the same.
 *
 * Read by the GS1 General Specifications' rules for where an identifier ends and how long its part is; a code that
 * does not read whole so is no GS1 code (a plain EAN-13, a QR code of a web address): null.
 */

/** The group separator (FNC1 in the middle of a code), as readers give it. */
const GS = '\u001d';

/** The parts of a fixed length, by their identifier's first two digits: the identifier and its part together (GS1 5.10.1). */
const FIXED: Record<string, number> = {
  '00': 20, '01': 16, '02': 16, '03': 16, '04': 18,
  '11': 8, '12': 8, '13': 8, '14': 8, '15': 8, '16': 8, '17': 8, '18': 8, '19': 8,
  '20': 4,
  '31': 10, '32': 10, '33': 10, '34': 10, '35': 10, '36': 10,
  '41': 16,
};

/** How many digits an identifier has, by its first two: two, three or four (GS1 3.2). */
function idLength(two: string): number {
  const n = Number(two);
  if (n <= 22 || n === 30 || n === 37 || n >= 90) return 2;
  if ((n >= 23 && n <= 25) || (n >= 40 && n <= 42) || n === 71) return 3;
  return 4;
}

/** A code's text as a scanner gives it, its symbology identifier and a leading FNC1 taken away. */
const bare = (text: string) => text.replace(/^\][A-Za-z][0-9A-Za-z]/, '').replace(new RegExp(`^${GS}+`), '');

/** The parts of a GS1 code, by Application Identifier — `{ "01": "06285096000842", "17": "281231", "10": "25A1234" }` — or null. */
export function readGs1(code: string): Record<string, string> | null {
  const parts = gs1Parts(code);
  return parts ? Object.fromEntries(parts) : null;
}

/** The parts of a GS1 code in the order it holds them, each its identifier and its value; null for a code that is none. */
export function gs1Parts(code: string): [string, string][] | null {
  const marked = /^\](d2|Q3|C1|e0|J1)/.test(code.trim()) || code.trim().startsWith(GS);
  const text = bare(code.trim());
  // Written by hand, or as a label prints it under the code: "(01)06285096000842(10)25A1234".
  if (text.startsWith('(')) {
    const parts: [string, string][] = [];
    const found = [...text.matchAll(/\((\d{2,4})\)([^()]*)/g)];
    if (!found.length || text.replace(/\((\d{2,4})\)[^()]*/g, '').trim() !== '') return null;
    for (const [, id, written] of found) {
      const value = written.trim();
      // A part as long as its identifier says, with no space in it: GS1's characters have none.
      const fixed = FIXED[id.slice(0, 2)];
      if (!value || /\s/.test(value) || (fixed !== undefined && value.length !== fixed - id.length)) return null;
      parts.push([id, value]);
    }
    return parts;
  }
  const parts: [string, string][] = [];
  let at = 0;
  while (at < text.length) {
    if (text[at] === GS) {
      at++;
      continue;
    }
    const two = text.slice(at, at + 2);
    if (!/^\d\d$/.test(two)) return null;
    const id = text.slice(at, at + idLength(two));
    if (!/^\d+$/.test(id) || id.length < idLength(two)) return null;
    const fixed = FIXED[two];
    let end: number;
    if (fixed !== undefined) {
      end = at + fixed;
      if (end > text.length) return null;
    } else {
      const gs = text.indexOf(GS, at);
      end = gs < 0 ? text.length : gs;
    }
    const value = text.slice(at + id.length, end);
    if (!value || value.includes(GS)) return null;
    parts.push([id, value]);
    at = end;
  }
  // Read whole as GS1, but a plain code it could also be — digits alone, unmarked — is GS1 only where it starts as one:
  // a product's GTIN, its lot, its expiry, its serial number.
  if (!marked && !parts.some(([id]) => ['00', '01', '02', '10', '17', '21'].includes(id))) return null;
  return parts.length ? parts : null;
}

/** The days a GS1 date part (YYMMDD) names: 2000 to 2099 by the specification's window round this year, "00" the month's last day. */
export function gs1Day(part: string, now: Date = new Date()): string | null {
  const found = /^(\d\d)(\d\d)(\d\d)$/.exec(part);
  if (!found) return null;
  const [yy, mm, dd] = [Number(found[1]), Number(found[2]), Number(found[3])];
  if (mm < 1 || mm > 12) return null;
  // GS1 7.12: the century that puts the year from 49 years before this one to 50 after it.
  const year = now.getUTCFullYear();
  let full = Math.floor(year / 100) * 100 + yy;
  if (full - year > 50) full -= 100;
  else if (year - full > 49) full += 100;
  const last = new Date(Date.UTC(full, mm, 0)).getUTCDate();
  const day = dd === 0 ? last : dd;
  if (day > last) return null;
  return `${String(full).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whether an identifier's part is a day (YYMMDD): production, packaging, best before, sell by, expiry. */
export const isGs1Day = (id: string) => /^1[1-7]$/.test(id);

/**
 * A part's number where it is one: a count (30, 37) as it is; a measure (310n to 369n, an amount 390n to 395n) with its
 * last digit's places ("3103" "001250": 1.25); else its digits as a whole number. Null for a part that holds other
 * characters.
 */
export function gs1Number(id: string, part: string): number | null {
  if (!/^\d+$/.test(part)) return null;
  const places = /^(3[1-6]\d|39[0-5])(\d)$/.exec(id);
  if (places) {
    // An amount with its currency first (391n, 393n): its ISO code's three digits before it.
    const digits = /^39[13]$/.test(places[1]) ? part.slice(3) : part;
    return Number(digits) / 10 ** Number(places[2]);
  }
  return Number(part);
}
