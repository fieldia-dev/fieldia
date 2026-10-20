import { addDays, addMonths, monthsBetween } from './dates';
import { listOf, localDay, numbersOf, opened, type ExpressionFunction } from './functions';
import { isNumber, roundTo, tidy } from './operations';
import { placesOfCurrency } from '../record/input-rules';

/**
 * The bodies of Fieldia's functions beyond the plain ones (the functions part, functions.ts): their names, and how many
 * values each takes, are the main table's, so a page reads and checks without them.
 */

/** A function's body: its call, what it takes being the main table's. */
type Body = Pick<ExpressionFunction, 'call'>;

/** Empty as a person sees it: nothing, text of only spaces, an empty list or object. Zero and no are values. */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

/** Text as compared whatever its case. */
const folded = (text: string) => text.toLowerCase();

/** A test on text whatever its case: false for empty text, null for what is not text. */
function textTest(test: (text: string, part: string) => boolean): Body {
  return {
    call({ args, value }) {
      const text = value(args[0]);
      const part = value(args[1]);
      if (text === null || text === undefined || text === '') return false;
      if (typeof text !== 'string' || (typeof part !== 'string' && !isNumber(part))) return null;
      return test(folded(text), folded(String(part)));
    },
  };
}

/** Text in capitals or small letters; null for what is not text. */
function textCase(upper: boolean): Body {
  return {
    call({ args, value }) {
      const text = value(args[0]);
      return typeof text === 'string' ? (upper ? text.toUpperCase() : text.toLowerCase()) : null;
    },
  };
}

/** A day moved by a whole number of days, months or years. */
function moveDay(move: (day: unknown, n: number) => string | null, times = 1): Body {
  return {
    call({ args, value }) {
      const n = value(args[1]);
      return isNumber(n) ? move(value(args[0]), Math.trunc(n) * times) : null;
    },
  };
}

/** Whole months, or years, from one day to another. */
function between(per: number): Body {
  return {
    call({ args, value }) {
      const months = monthsBetween(value(args[0]), value(args[1]));
      return months === null ? null : Math.trunc(months / per);
    },
  };
}

const BODIES: [string, Body][] = [
  [
    'age',
    {
      // Whole years from a birth date to a day — today on the page's clock unless given — as years() counts them.
      call({ args, value, env }) {
        const months = monthsBetween(value(args[0]), args.length > 1 ? value(args[1]) : (env.today?.() ?? localDay(new Date())));
        return months === null ? null : Math.trunc(months / 12);
      },
    },
  ],
  ['years', between(12)],
  ['months', between(1)],
  ['addDays', moveDay(addDays)],
  ['addMonths', moveDay(addMonths)],
  ['addYears', moveDay(addMonths, 12)],
  [
    'contains',
    {
      // Text holding words, whatever their case; a list (choices ticked, links) holding a value.
      call({ args, value }) {
        const where = value(args[0]);
        const what = value(args[1]);
        if (Array.isArray(where)) return where.includes(what);
        if (where === null || where === undefined || where === '') return false;
        if (typeof where !== 'string' || (typeof what !== 'string' && !isNumber(what))) return null;
        return folded(where).includes(folded(String(what)));
      },
    },
  ],
  ['startsWith', textTest((text, part) => text.startsWith(part))],
  ['endsWith', textTest((text, part) => text.endsWith(part))],
  ['upper', textCase(true)],
  ['lower', textCase(false)],
  [
    'join',
    {
      // The values after the first, lists opened, empty ones left out, with the first between them: join(' ', first, last).
      call(call) {
        const between = call.value(call.args[0]);
        if (typeof between !== 'string') return null;
        const items = opened(call, call.args.slice(1)).filter((item) => !isBlank(item));
        if (!items.every((item) => typeof item === 'string' || isNumber(item))) return null;
        return items.map(String).join(between);
      },
    },
  ],
  [
    'average',
    {
      // Of the values or a list — or, as sum takes them, a field of the lines where a condition holds — empty ones left out.
      call(call) {
        const lines = call.args[1]?.type === 'Literal' && typeof call.args[1].value === 'string';
        let numbers: unknown[];
        if (lines) {
          const list = listOf(call);
          if (list !== null && list !== undefined && !Array.isArray(list)) return null;
          numbers = numbersOf(call, (list as unknown[] | null) ?? []);
        } else {
          numbers = opened(call);
          if (!numbers.every(isNumber)) return null;
        }
        const all = numbers as number[];
        return all.length ? tidy(all.reduce((total, n) => total + n, 0) / all.length) : null;
      },
    },
  ],
  [
    'roundMoney',
    {
      // Rounded to its currency's places: 3 for a Jordanian dinar, 0 for a yen, 2 for most. A link to a currency is read by its name.
      call({ args, value, env }) {
        const amount = value(args[0]);
        const named = args[1].type === 'Identifier' ? env.nameOf?.(args[1].name) : undefined;
        const currency = named ?? value(args[1]);
        if (!isNumber(amount) || typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)) return null;
        return roundTo(amount, placesOfCurrency(currency.toUpperCase()));
      },
    },
  ],
  ['empty', { call: ({ args, value }) => isBlank(value(args[0])) }],
  [
    'firstOf',
    {
      // The first value that is not empty — zero and no are values — read only as far as it is found.
      call({ args, value }) {
        for (const arg of args) {
          const found = value(arg);
          if (!isBlank(found)) return found;
        }
        return null;
      },
    },
  ],
];

const BY_NAME = new Map(BODIES);

/** A function's body, by its name: what its stand-in in the main table calls once the part has come. */
export function functionBody(name: string): ExpressionFunction['call'] {
  return (BY_NAME.get(name) as Body).call;
}
