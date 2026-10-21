import { foldDigits, foldForSearch, readNumber, stripMarks, type Locale, type NumberRead, type NumberReadOptions } from '@fieldia/core';
import type { Shorthand } from './input-rules';
import { fillIn, wordsFor } from './kind-parts';
import { installTypedStyles } from './styles-typed';
import type { WidgetLabels } from './labels';

/**
 * Amounts typed in shorthand (`options.shorthand` on a number or an amount): "3.5m", "500k", "1.2bn", "٣٫٥ مليون",
 * "3,5 Mio.", "2 millions" — the number read by the number reader in the page's way, its word read as the power of
 * ten it names. The words are the page's language's own, as Intl writes compact numbers in it — short and long, every
 * form it uses ("ألف", "آلاف"; "Million", "Millionen") — and English's, beside the letters people type the world over:
 * k, m, mn, b, bn. No language's words are carried in the code: Intl gives them. In the typed part.
 */

/** The letters typed for a thousand, a million and a billion wherever the page is: a word of the page's language wins. */
const LETTERS: [string, number][] = [['k', 3], ['m', 6], ['mn', 6], ['b', 9], ['bn', 9]];
/** A word as it is looked up: folded as a search folds it (its case, its Arabic forms), its dot ("Mio.") let go. */
const keyOf = (word: string) => foldForSearch(word).replace(/\.+$/, '').replace(/\s+/g, ' ').trim();

const tables = new Map<string, Map<string, number>>();
/** Every word for a power of ten a page's language (then English) writes compact numbers with, and the letters. */
function wordsOf(locale: Locale): Map<string, number> {
  let table = tables.get(locale);
  if (table) return table;
  table = new Map();
  for (const language of new Set([locale, 'en'])) {
    for (const compactDisplay of ['short', 'long'] as const) {
      let format: Intl.NumberFormat;
      try {
        format = new Intl.NumberFormat(language, { notation: 'compact', compactDisplay, numberingSystem: 'latn' });
      } catch {
        continue;
      }
      for (const power of [3, 6, 9, 12]) {
        for (const times of [1, 2, 3, 5, 11, 100]) {
          const value = times * 10 ** power;
          const parts = format.formatToParts(value);
          const word = keyOf(parts.filter((part) => part.type === 'compact').map((part) => part.value).join(' '));
          const shown = Number(parts.filter((part) => part.type === 'integer' || part.type === 'fraction' || part.type === 'decimal').map((part) => (part.type === 'decimal' ? '.' : part.value)).join(''));
          // The power the word stands for, from the number it was written beside: a lakh is 10⁵ where Intl writes one.
          const named = shown ? Math.round(Math.log10(value / shown)) : 0;
          if (word && named > 0 && !/\d/.test(word) && !table.has(word)) table.set(word, named);
        }
      }
    }
  }
  for (const [letter, power] of LETTERS) if (!table.has(letter)) table.set(letter, power);
  tables.set(locale, table);
  return table;
}

/** A number and the word after it: "3.5m", "3.5 m", "٣٫٥ مليون", "1,2 Mrd.", "1.2 mil M" — its words of letters and dots. */
const SPLIT = /^(.*\d)\s*(\p{L}[\p{L}.]*(?:\s+\p{L}[\p{L}.]*)?)$/u;

/** The shorthand a number box reads in a page's language (input-rules.ts `Shorthand`), and the words it says. */
export function shorthandFor(locale: Locale, labels?: WidgetLabels): Shorthand {
  const table = wordsOf(locale);
  const words = wordsFor(labels, locale);
  const plain = (text: string) => foldDigits(stripMarks(text)).trim();
  const example = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' }).format(3_500_000);
  /** The number and the power of ten its last word names ("3.5m": "3.5", 6); null where it names none. */
  const split = (text: string) => {
    const found = SPLIT.exec(plain(text));
    const power = found ? table.get(keyOf(found[2])) : undefined;
    return found && power ? { body: found[1], power } : null;
  };
  /** The number typed before a word on its way to one ("3.5 mil"), which the keys are judged on; null where there is none. */
  const partial = (text: string) => {
    const found = SPLIT.exec(plain(text));
    if (!found) return null;
    const typed = keyOf(found[2]);
    for (const word of table.keys()) if (word.startsWith(typed)) return found[1];
    return null;
  };
  const read = (text: string, options: NumberReadOptions = {}): NumberRead | null => {
    const short = split(text);
    if (!short) return null;
    const number = readNumber(short.body, locale, options);
    if (!number.ok || number.value === null) return number;
    // Worked out on the digits, never by a float's multiplication: 1.1m is 1,100,000, not 1,100,000.0000000002.
    const [whole, fraction = ''] = number.plain.replace(/^-/, '').split(/\D/);
    const digits = (whole + fraction.padEnd(short.power, '0')).replace(/^0+(?=\d)/, '');
    const at = digits.length - Math.max(0, fraction.length - short.power);
    const scaled = at > 0 ? `${digits.slice(0, at)}${at < digits.length ? `.${digits.slice(at)}` : ''}` : `0.${'0'.repeat(-at)}${digits}`;
    return readNumber(`${number.value < 0 ? '-' : ''}${scaled}`, 'en', options);
  };
  return {
    read,
    rules: (rules, box) => ({
      ...rules,
      // The number before its word, or one on its way, is what the keys are judged on; a letter no word begins with
      // is refused saying shorthand is taken too.
      judge(next, before) {
        const why = rules.judge(partial(next) ?? next, partial(before) ?? before);
        return why === fillIn(words.numbersOnly, { label: box.label }) ? fillIn(words.shorthandOnly, { label: box.label, example }) : why;
      },
      // An amount pasted in shorthand: as it was written, read as the box reads it.
      paste: (text) => (read(stripMarks(text).trim())?.ok ? { text: stripMarks(text).trim() } : (rules.paste?.(text) ?? { text })),
    }),
    watch(input, written) {
      // What it reads, said under the box in a line of its own — politely, never in a refusal's colours — while what
      // is typed is in shorthand; gone once it is not, or the box is left and shows the whole amount.
      installTypedStyles(input.ownerDocument);
      const said = input.ownerDocument.createElement('div');
      said.className = 'fd-shorthand-said';
      said.setAttribute('role', 'status');
      said.hidden = true;
      const say = (text: string) => {
        if (!said.isConnected) (input.closest('.fd-number') ?? input).after(said);
        said.textContent = text;
        said.hidden = !text;
      };
      input.addEventListener('input', () => {
        const value = read(input.value);
        say(value?.ok && value.value !== null ? fillIn(words.shorthandIs, { typed: input.value.trim(), amount: written(value.value) }) : '');
      });
      input.addEventListener('blur', () => say(''));
    },
  };
}
