import { foldDigits, stripMarks } from '@fieldia/core';
import { PHONE_TABLE } from './phone-table';

/**
 * Phone numbers the world over, read and written by the phone part's table (phone-table.ts, made from
 * libphonenumber's metadata by tools/phone-table.mjs): a number typed at home ("010 1234 5678", in a country picked)
 * or abroad ("+20 10 1234 5678", "0020 10…"), in any digits, checked by its country — its length by how it starts,
 * and whether any number there starts so — kept as E.164 ("+201012345678"), and written back in its country's
 * groups, at home's way or abroad's. A number's country is the one its dialling code is, or, where countries share
 * one (+1, +7, +44), the one whose numbers start so.
 */

/** A country, as its numbers are read: its ISO code, its dialling code, and the digit a number is dialled with at home ("" for none). */
export interface PhoneCountry {
  readonly code: string;
  readonly dial: string;
  readonly trunk: string;
}

/** How a number is written in groups: the starts it is for, its groups' least and most digits, and how it is laid out at home and abroad. */
interface Format {
  readonly starts: RegExp | null;
  readonly groups: readonly (readonly [number, number])[];
  readonly home: string;
  readonly abroad: string;
  readonly rule: string;
}

interface Plan extends PhoneCountry {
  /** Every prefix a number is dialled with at home, the longest first: the trunk digit, and any other (Belarus's 80). */
  readonly trunks: readonly string[];
  /** How the first group is written at home: "0~" puts the trunk digit before it, "(~)" brackets it. */
  readonly rule: string;
  readonly rules: readonly { readonly starts: RegExp; readonly lengths: readonly number[] }[];
  readonly formats: readonly Format[];
}

let plans: Map<string, Plan> | undefined;
/** Each dialling code's countries: the code's own first, then those sharing it. */
let byDial: Map<string, Plan[]> | undefined;

const lengthOf = (char: string) => (char <= '9' ? Number(char) : char.charCodeAt(0) - 87);
/** A format's layout read: its groups (a letter, or a capital and a letter for either length) and the rest as written. */
function groupsOf(layout: string): [number, number][] {
  return [...layout.matchAll(/([A-Z])?([a-z])/g)].map(([, least, most]) => [(least ?? most).toLowerCase().charCodeAt(0) - 96, most.charCodeAt(0) - 96]);
}

/** The table read, the first time a number is: every country by its code, and by its dialling code. */
function read(): Map<string, Plan> {
  if (plans) return plans;
  plans = new Map();
  byDial = new Map();
  for (const line of PHONE_TABLE.split('\n')) {
    const [code, dial, trunk, rule, rules, ...rest] = line.split(' ');
    const main = byDial.get(dial)?.[0];
    const formats = rest.length
      ? rest
          .join(' ')
          .split('!')
          .map((one): Format => {
            const [starts, shape] = [one.slice(0, one.indexOf('/')), one.slice(one.indexOf('/') + 1)];
            const [layout, own] = shape.split('=');
            // Abroad, its groups apart with spaces alone (ITU-T E.123), unless the table says otherwise.
            const [home, abroad = home.replace(/[^A-Za-z]+/g, ' ').trim()] = layout.split(';');
            return { starts: starts ? new RegExp(`^(?:${starts})`) : null, groups: groupsOf(home), home, abroad, rule: own ?? rule.replace(/_/g, ' ') };
          })
      : (main?.formats ?? []);
    const plan: Plan = {
      code,
      dial,
      trunk: trunk === '-' ? '' : trunk.split(',')[0],
      trunks: trunk === '-' ? [] : trunk.split(',').sort((a, b) => b.length - a.length),
      rule: rule.replace(/_/g, ' '),
      rules: rules.split(',').map((one) => {
        const at = one.indexOf(':');
        return { starts: new RegExp(`^(?:${one.slice(at + 1)})`), lengths: [...one.slice(0, at)].map(lengthOf) };
      }),
      formats,
    };
    plans.set(code, plan);
    byDial.set(dial, [...(byDial.get(dial) ?? []), plan]);
  }
  return plans;
}

/** Every country whose numbers the table knows. */
export function phoneCountries(): PhoneCountry[] {
  return [...read().values()];
}

/** A country by its ISO code, or undefined when the table has none so. */
export function phoneCountry(code: string | null | undefined): PhoneCountry | undefined {
  return code ? read().get(code.toUpperCase()) : undefined;
}

/** A country's flag, from its code's two letters (shown as those letters where a system draws no flags). */
export const flagOf = (code: string): string => String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));

/** Why a number does not read: no country to read it in, no country's code, too short, too long, or no number there starts so. */
export type PhoneProblem = 'country' | 'code' | 'short' | 'long' | 'start';

/** A number read: kept as E.164 with its country, or why it is not one (with the country it was read in, and the start none there has). */
export type PhoneReading = { readonly number: string; readonly country: string } | { readonly problem: PhoneProblem; readonly country?: string; readonly start?: string };

/** Whether some number of a country starts with these digits, however few: its starts are three digits at most where it shares its code, two else, more only where it must. */
function canStart(plan: Plan, digits: string): boolean {
  if (digits.length >= 3) return plan.rules.some((one) => one.starts.test(digits));
  for (let n = 0; n < 10 ** (3 - digits.length); n++) {
    const tried = digits + String(n).padStart(3 - digits.length, '0');
    if (plan.rules.some((one) => one.starts.test(tried))) return true;
  }
  return false;
}

/** Whether a country has a number of these digits (its national significant number): fine, or why not. */
function check(plan: Plan, digits: string): PhoneProblem | null {
  const rule = plan.rules.find((one) => one.starts.test(digits));
  // Too few digits yet to know how it starts: short, not wrong.
  if (!rule) return canStart(plan, digits) ? 'short' : 'start';
  if (rule.lengths.includes(digits.length)) return null;
  return rule.lengths.some((n) => n > digits.length) ? 'short' : 'long';
}

/**
 * Which of the countries sharing a dialling code a number is: `first` if it is one of them and has it, else one
 * whose numbers start so, else the code's own. With the problem it has there when none has it.
 */
function placed(dial: string, digits: string, first?: string): { plan: Plan; problem: PhoneProblem | null } {
  read();
  const sharing = byDial?.get(dial) ?? [];
  const order = [...sharing.filter((plan) => plan.code === first), ...sharing.slice(1).filter((plan) => plan.code !== first), sharing[0]];
  for (const plan of order) if (!check(plan, digits)) return { plan, problem: null };
  // None has it: the one it starts as (too short or too long there), else the first asked.
  const plan = order.find((one) => check(one, digits) !== 'start') ?? order[0];
  return { plan, problem: check(plan, digits) };
}

/** A number's digits after its dialling code: as given, or without the trunk digit typed after it ("+44 (0)20…", "+20 010…") when only that reads. */
function afterCode(dial: string, digits: string, first?: string): { plan: Plan; digits: string; problem: PhoneProblem | null } {
  const found = placed(dial, digits, first);
  if (!found.problem) return { ...found, digits };
  for (const trunk of found.plan.trunks) {
    if (!digits.startsWith(trunk)) continue;
    const without = placed(dial, digits.slice(trunk.length), first);
    if (!without.problem) return { ...without, digits: digits.slice(trunk.length) };
  }
  return { ...found, digits };
}

/** The digits after a number's + (or 00) as typed, or null for a number typed at home's way; `home`, for a +1 country's 011. */
function abroadDigits(text: string, home?: PhoneCountry): string | null {
  const typed = foldDigits(stripMarks(text)).trim();
  const digits = typed.replace(/\D/g, '');
  return typed.startsWith('+') ? digits : digits.startsWith('00') ? digits.slice(2) : home?.dial === '1' && digits.startsWith('011') ? digits.slice(3) : null;
}

/** A number typed with its + (or 00) and a dialling code: that code and the digits after it; undefined for one typed at home's way, or with no country's code. */
export function typedCode(text: string): { dial: string; digits: string } | undefined {
  const abroad = abroadDigits(text);
  if (abroad === null) return undefined;
  read();
  const dial = [1, 2, 3].map((n) => abroad.slice(0, n)).find((code) => byDial?.has(code));
  return dial ? { dial, digits: abroad.slice(dial.length) } : undefined;
}

/**
 * A phone number as typed or pasted, read: with a + (or 00, or a +1 country's 011) and its dialling code, in the
 * country that code is; else at home in `country` — its trunk digit (Egypt's 0, Russia's 8, +1's 1) dropped, or its
 * dialling code typed without the + — by any digits, spaces, dots, dashes and brackets. Kept as E.164 with its
 * country, or why it is not a number: none to read it in (no + and no country), no country's code, too short or too
 * long there, or no number there starts so (`start`, as typed).
 */
export function readPhone(text: string, country?: string | null): PhoneReading {
  const digits = foldDigits(stripMarks(text)).replace(/\D/g, '');
  const home = phoneCountry(country);
  const abroad = abroadDigits(text, home);
  if (abroad !== null) {
    read();
    const dial = [1, 2, 3].map((n) => abroad.slice(0, n)).find((code) => byDial?.has(code));
    if (!dial) return { problem: abroad.length < 3 ? 'short' : 'code', start: `+${abroad.slice(0, 3)}` };
    const found = afterCode(dial, abroad.slice(dial.length), home?.code);
    if (found.problem) return { problem: found.problem, country: found.plan.code, start: `+${dial} ${found.digits.slice(0, 2)}` };
    return { number: `+${dial}${found.digits}`, country: found.plan.code };
  }
  if (!home) return { problem: 'country' };
  // At home: without its trunk digit, or as typed, or without its dialling code typed with no +.
  const trunk = (read().get(home.code) as Plan).trunks.find((one) => digits.startsWith(one));
  const tries = [...(trunk ? [digits.slice(trunk.length)] : []), digits, ...(digits.startsWith(home.dial) ? [digits.slice(home.dial.length)] : [])];
  for (const one of tries) {
    const found = placed(home.dial, one, home.code);
    if (!found.problem) return { number: `+${home.dial}${one}`, country: found.plan.code };
  }
  const own = tries[0];
  const problem = check(read().get(home.code) as Plan, own) ?? 'start';
  return { problem, country: home.code, start: digits.slice(0, own.length < digits.length ? digits.length - own.length + 2 : 2) };
}

/** An E.164 number's country and its digits after the dialling code; undefined for one that is not E.164 or not a number. */
export function phoneParts(number: string): { country: string; dial: string; digits: string } | undefined {
  if (!/^\+\d{4,15}$/.test(number)) return undefined;
  const reading = readPhone(number);
  if (!('number' in reading) || reading.number !== number) return undefined;
  const dial = (phoneCountry(reading.country) as PhoneCountry).dial;
  return { country: reading.country, dial, digits: number.slice(dial.length + 1) };
}

/** How many digits go in each of a long group's parts: fours, the shorter ones first ("1234 5678", "123 4567", "123 456 789"). */
function split(digits: string): string {
  if (digits.length <= 6) return digits;
  const count = Math.ceil(digits.length / 4);
  const parts: string[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.floor((digits.length + i) / count);
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  return parts.join(' ');
}

/** A number's digits in its country's groups, laid out at home (its first group as `rule` writes it) or abroad. */
function grouped(plan: Plan, digits: string, atHome: boolean): string {
  const format = plan.formats.find((one) => {
    if (one.starts && !one.starts.test(digits)) return false;
    const least = one.groups.reduce((sum, [n]) => sum + n, 0);
    const most = one.groups.reduce((sum, [, n]) => sum + n, 0);
    return digits.length >= least && digits.length <= most;
  });
  // No format for it: its digits in fours, at home as abroad (no trunk digit said where its country says none).
  if (!format) return split(digits);
  // Each group its least digits, the group of either length the rest.
  const extra = digits.length - format.groups.reduce((sum, [n]) => sum + n, 0);
  let left = extra;
  let at = 0;
  const parts = format.groups.map(([least, most]) => {
    const size = least + Math.min(left, most - least);
    left -= size - least;
    const part = digits.slice(at, at + size);
    at += size;
    return split(part);
  });
  let n = 0;
  const layout = atHome ? format.home : format.abroad;
  return layout.replace(/[A-Z]?[a-z]/g, () => {
    const part = parts[n++] ?? '';
    return n === 1 && atHome ? format.rule.replace('~', part) : part;
  });
}

/**
 * A number as people read it: abroad's way, "+20 10 1234 5678", or at home's, "010 1234 5678" — at home only for a
 * number of `home`'s dialling code (one of another country is always written abroad's way). Text that is no E.164
 * number is written as it is.
 */
export function writePhone(number: string, shown: 'international' | 'national' = 'international', home?: string | null): string {
  const parts = phoneParts(number);
  if (!parts) return number;
  const plan = read().get(parts.country) as Plan;
  const atHome = shown === 'national' && phoneCountry(home)?.dial === parts.dial;
  return atHome ? grouped(plan, parts.digits, true) : `+${parts.dial} ${grouped(plan, parts.digits, false)}`;
}

/** Where a number's links go: a call (`tel:`) and a WhatsApp chat (wa.me); undefined for one that is not a number. */
export function phoneLinks(number: string): { call: string; whatsapp: string } | undefined {
  return phoneParts(number) ? { call: `tel:${number}`, whatsapp: `https://wa.me/${number.slice(1)}` } : undefined;
}

/**
 * A field's number as people read it, as `writePhone` writes it: E.164 as it is, and one kept another way (an older
 * record's "+20 2 2345 6789", "02 2345 6789") read first, in `home` when typed at home's way. Text that is no number,
 * as it is.
 */
export function shownPhone(value: string, shown: 'international' | 'national' = 'international', home?: string | null): string {
  if (phoneParts(value)) return writePhone(value, shown, home);
  const reading = value.trim() ? readPhone(value, home) : undefined;
  return reading && 'number' in reading ? writePhone(reading.number, shown, home) : value;
}
