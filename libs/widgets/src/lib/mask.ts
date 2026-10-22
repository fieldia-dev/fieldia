import { foldDigits } from '@fieldia/core';

/**
 * A mask: the shape a value is typed in, character by character — a national ID's digits, an IBAN's groups, a car
 * plate's letters and digits. Its pattern (`options.mask` on a char field) is written with
 *
 *   9  a digit, in any script (kept as 0-9)
 *   a  a letter, in any script
 *   *  a letter or a digit
 *   \  before any character: that character itself (\9 is a nine)
 *   [ ]  round the end of it: what may be left out (an IBAN's last groups, whose length is its country's)
 *
 * and every other character is the mask's own — a space, a dash, a slash, "SA" — written in as the person types.
 * What is typed is laid out against it (`conform`): a character where a slot takes it is taken, a mask's own character
 * typed where it stands is passed over, a space, dash, dot or slash typed elsewhere is let go, and anything else is
 * refused with where and why. In the typed part, with its box.
 */

export type SlotKind = 'digit' | 'letter' | 'either';
export type MaskPart = { slot: SlotKind; optional: boolean } | { own: string; optional: boolean };
export interface Mask {
  parts: MaskPart[];
  /** Slots a whole value fills: those not in the part that may be left out. */
  needed: number;
  /** Slots it may fill in all. */
  most: number;
  /** Letters typed into it written in capitals (`options.upper`): an IBAN's, a plate's. */
  upper: boolean;
}

/** A mask's pattern read: null for one that names no slot, which masks nothing. */
export function readMask(pattern: string, upper = false): Mask | null {
  const parts: MaskPart[] = [];
  let optional = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\' && i + 1 < pattern.length) parts.push({ own: pattern[++i], optional });
    else if (char === '[') optional = true;
    else if (char === ']') optional = false;
    else if (char === '9') parts.push({ slot: 'digit', optional });
    else if (char === 'a') parts.push({ slot: 'letter', optional });
    else if (char === '*') parts.push({ slot: 'either', optional });
    else parts.push({ own: char, optional });
  }
  const slots = parts.filter((part) => 'slot' in part);
  if (!slots.length) return null;
  return { parts, needed: slots.filter((part) => !part.optional).length, most: slots.length, upper };
}

const DIGIT = /^\p{Nd}$/u;
const LETTER = /^\p{L}$/u;
/** Characters typed between groups that no slot takes and that are let go where the mask has none: a space, a dash, a dot, a slash. */
const BETWEEN = /^[\s\-./]$/;
const fits = (slot: SlotKind, char: string) => (slot === 'digit' ? DIGIT.test(char) : slot === 'letter' ? LETTER.test(char) : DIGIT.test(char) || LETTER.test(char));
const same = (a: string, b: string) => a === b || a.toLowerCase() === b.toLowerCase();

/** Text laid out against a mask: as the box shows it, the characters its slots hold, how many — or where one does not fit, and why. */
export type Conformed = { ok: true; shown: string; typed: string; filled: number } | { ok: false; at: number; char: string; want: SlotKind | 'room' };

/**
 * `text` laid out against `mask`: each character in a slot that takes it (a digit as 0-9, a letter in capitals where the
 * mask says), the mask's own characters written between them, up to the last slot filled — and with `open`, those
 * after it too, up to the next slot, so the next key lands after the space it would type. Or the first character that
 * does not fit, and what its place wants.
 */
export function conform(text: string, mask: Mask, open = false): Conformed {
  const { parts } = mask;
  let shown = '';
  let typed = '';
  let filled = 0;
  let pos = 0;
  /** The mask's own characters passed since the last slot filled: written once the next one fills. */
  let pending = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    // The mask's own characters at this place are passed; one typed as it stands is taken as itself.
    let own = false;
    while (pos < parts.length && 'own' in parts[pos]) {
      const mark = (parts[pos++] as { own: string }).own;
      pending += mark;
      if (same(char, mark)) {
        own = true;
        break;
      }
    }
    if (own) continue;
    const part = parts[pos];
    if (!part || !fits((part as { slot: SlotKind }).slot, char)) {
      // A space, a dash, a dot or a slash typed between groups is let go; anything else is refused where it stands.
      if (BETWEEN.test(char)) continue;
      return { ok: false, at: i, char, want: part ? (part as { slot: SlotKind }).slot : 'room' };
    }
    const kept = DIGIT.test(char) ? foldDigits(char) : mask.upper ? char.toLocaleUpperCase() : char;
    shown += pending + kept;
    pending = '';
    typed += kept;
    filled++;
    pos++;
  }
  // The mask's own characters after the last slot filled, up to the next slot it needs: "2901 " as the fifth digit is
  // due — never before a part that may be left out, which is written once its first character is typed.
  // Every slot filled: the mask's own characters after the last are written too ("12 %").
  if (open || filled === mask.most) {
    let more = pending;
    while (pos < parts.length && 'own' in parts[pos]) more += (parts[pos++] as { own: string }).own;
    if (pos >= parts.length ? filled === mask.most : !parts[pos].optional) shown += more;
  }
  return { ok: true, shown, typed, filled };
}

/** A value as the mask shows it, when it fits; null for one it does not (a value from outside, kept as it came). */
export function masked(value: string, mask: Mask): string | null {
  const read = conform(value, mask);
  return read.ok && read.filled >= mask.needed ? read.shown : null;
}

/** The mask as a placeholder: its own characters, each slot a "_" — "____ ____ ____ __". */
export const maskShape = (mask: Mask): string => mask.parts.filter((part) => !part.optional).map((part) => ('own' in part ? part.own : '_')).join('');

/**
 * Where the caret goes in `shown` (as `conform` wrote it, each character in its part's place) to stand before the
 * slot after its `slots` characters typed — past the mask's own characters before it — or at its end.
 */
export function caretAfter(shown: string, mask: Mask, slots: number): number {
  let count = 0;
  for (let i = 0; i < shown.length && i < mask.parts.length; i++) {
    if (!('slot' in mask.parts[i])) continue;
    if (count === slots) return i;
    count++;
  }
  return shown.length;
}
