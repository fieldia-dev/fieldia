import type { LineField, MoneyLook } from '@fieldia/core';
import { displayValue } from './display';
import { moneyReads, shortNumber, writeMoney } from './money';

/**
 * An amount as a page's money look writes it, wherever it is read: by code
 * or by symbol, before or after, short, the home currency unsaid, what it is
 * for. Left out, an amount is written exactly as it always was. Each text
 * keeps its own direction: no marks that turn Latin money round on an
 * Arabic page, and a symbol kept whole there.
 */

const money = (look?: MoneyLook, extra: Partial<LineField> = {}) => ({ type: 'monetary', label: 'Price', currencyField: 'currency', digits: [16, 0], ...(look ? { money: look } : {}), ...extra }) as LineField;
const FSI = '\u2068';
const PDI = '\u2069';

describe('an amount, as its money look writes it', () => {
  it('writes the currency by its code after the amount, as Dawarly writes prices, in each language', () => {
    const price = money({ currency: 'code', at: 'after' });
    expect(displayValue(price, 1_610_000, { currency: 'EGP' })).toBe('1,610,000\u00a0EGP');
    // Latin digits, and no marks: the amount reads left to right on an Arabic page too.
    expect(displayValue(price, 1_610_000, { currency: 'EGP' }, 'ar')).toBe('1,610,000\u00a0EGP');
    expect(displayValue(price, 1_610_000, { currency: 'EGP' }, 'de')).toBe('1.610.000\u00a0EGP');
    expect(displayValue(price, 1_610_000, { currency: 'EGP' }, 'fr')).toBe('1\u202f610\u202f000\u00a0EGP');
    expect(displayValue(money({ currency: 'code', at: 'before' }), 450_000, { currency: 'USD' })).toBe('USD\u00a0450,000');
  });

  it('writes a symbol where the language puts it, kept whole on a right-to-left page', () => {
    expect(displayValue(money({}), 1_610_000, { currency: 'EGP' })).toBe('E£\u00a01,610,000');
    expect(displayValue(money({}), 1_610_000, { currency: 'EUR' }, 'de')).toBe('1.610.000\u00a0€');
    // "E£" isolated as left to right: never turned round to "£E" in Arabic.
    expect(displayValue(money({}), 1_610_000, { currency: 'EGP' }, 'ar')).toBe(`1,610,000\u00a0${FSI}E£${PDI}`);
    expect(displayValue(money({ at: 'before' }), 1_610_000, { currency: 'EGP' }, 'ar')).toBe(`${FSI}E£${PDI}\u00a01,610,000`);
    // An Arabic symbol is set apart too, in its own direction: the riyal's dots stay where they are written.
    expect(displayValue(money({}), 1_500, { currency: 'SAR' }, 'ar')).toContain(`${FSI}ر.س.${PDI}`);
    expect(displayValue(money({}), 1_500, { currency: 'JOD' }, 'ar')).toContain(`${FSI}د.أ.${PDI}`);
    // A currency named by words that are no code: as written, before the amount.
    expect(displayValue(money({}), 12, { currency: 'Gold coins' })).toBe('Gold coins\u00a012');
  });

  it('writes it short, in the page’s language and Latin digits', () => {
    const short = money({ short: true, currency: 'code', at: 'after' });
    expect(displayValue(short, 13_900_000, { currency: 'EGP' })).toBe('13.9M\u00a0EGP');
    expect(displayValue(short, 450_000, { currency: 'USD' })).toBe('450K\u00a0USD');
    expect(displayValue(short, 13_900_000, { currency: 'EGP' }, 'ar')).toBe('13.9\u00a0مليون\u00a0EGP');
    expect(shortNumber(4_500_000)).toBe('4.5M');
    expect(shortNumber(13_900_000, 'ar')).toBe('13.9\u00a0مليون');
    expect(shortNumber(13_900_000, 'de')).toBe('13,9\u00a0Mio.');
  });

  it('leaves the home currency unsaid, and names any other', () => {
    const look: MoneyLook = { short: true, home: 'EGP', currency: 'symbol', at: 'before' };
    expect(writeMoney(13_900_000, 'EGP', 0, 'en', look)).toBe('13.9M');
    expect(writeMoney(450_000, 'USD', 0, 'en', look)).toBe('$\u00a0450K');
    expect(writeMoney(13_900_000, 'EGP', 0, 'ar', look)).toBe('13.9\u00a0مليون');
    expect(writeMoney(450_000, 'USD', 0, 'ar', look)).toBe(`${FSI}US$${PDI}\u00a0450\u00a0ألف`);
    expect(writeMoney(12, null, 2, 'en', look)).toBe('12');
  });

  it('says what the amount is for while its condition holds, the first that holds, in each language', () => {
    const look: MoneyLook = { currency: 'code', at: 'after', per: [{ period: 'month', when: "offer == 'rent'" }, { period: 'night', when: "offer == 'holiday'" }] };
    const rent = { currency: 'EGP', offer: 'rent' };
    expect(displayValue(money(look), 25_000, rent)).toBe('25,000\u00a0EGP/month');
    expect(displayValue(money(look), 25_000, rent, 'ar')).toBe('\u206825,000\u00a0EGP\u2069/شهر');
    expect(displayValue(money(look), 25_000, rent, 'fr')).toBe('25\u202f000\u00a0EGP/mois');
    expect(displayValue(money(look), 25_000, rent, 'de')).toBe('25.000\u00a0EGP/Monat');
    expect(displayValue(money(look), 3_000, { currency: 'EGP', offer: 'holiday' })).toBe('3,000\u00a0EGP/night');
    expect(displayValue(money(look), 25_000, { currency: 'EGP', offer: 'sale' })).toBe('25,000\u00a0EGP');
    // Without a condition: always; a link reads as its id.
    expect(writeMoney(90, 'EGP', 0, 'en', { home: 'EGP', per: [{ period: 'day' }] })).toBe('90/day');
    expect(writeMoney(90, 'EGP', 0, 'en', { home: 'EGP', per: [{ period: 'week', when: 'kind_id == 3' }] }, { kind_id: { id: 3, label: 'Weekly' } })).toBe('90/week');
  });

  it('writes an amount as it always was without a look', () => {
    expect(displayValue(money(), 425_000, { currency: 'EGP' })).toBe('E£\u00a0425,000');
    expect(displayValue(money(), 425_000, { currency: 'EGP' }, 'ar')).toBe('\u200f425,000\u00a0E£');
  });

  it('names the fields its words read: its currency’s, and its conditions’', () => {
    expect(moneyReads(money({ per: [{ period: 'month', when: "offer == 'rent' and furnished" }] }))).toEqual(['currency', 'offer', 'furnished']);
    expect(moneyReads(money(), { per: [{ period: 'month', when: 'is_rent' }] })).toEqual(['currency', 'is_rent']);
    expect(moneyReads(money(undefined, { currencyField: 'parent.currency_id' } as Partial<LineField>))).toEqual([]);
    expect(moneyReads({ type: 'char', label: 'Name' } as LineField)).toEqual([]);
  });
});
