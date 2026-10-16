import type { LineField } from '@fieldia/core';
import { WIDGET_LABELS } from '@fieldia/widgets';
import { blockOf, readPastedCell, whyNotPasted } from './cell-paste';

/**
 * A block pasted on the grid's cells (FIELDIA INPUT RULES, 8), as a
 * spreadsheet copies one: each cell read as its column reads what is typed,
 * or not at all.
 */

const float = { type: 'float', label: 'Quantity', digits: [8, 2] } as LineField;
const integer = { type: 'integer', label: 'Seats' } as LineField;

describe('a block pasted on a table', () => {
  it('is rows by line breaks and cells by tabs, the copied block’s last line break no row of its own', () => {
    expect(blockOf('3\t100\n4\t200\n')).toEqual([['3', '100'], ['4', '200']]);
    expect(blockOf('3\t100\r\n4\t200')).toEqual([['3', '100'], ['4', '200']]);
    expect(blockOf('٣')).toEqual([['٣']]);
  });

  it('reads each cell as its column reads what is typed, or not at all', () => {
    const en = { locale: 'en' as const };
    expect(readPastedCell(float, '٣', en)).toEqual({ value: 3 });
    expect(readPastedCell(float, '1,234.5', en)).toEqual({ value: 1234.5 });
    expect(readPastedCell(float, '1.234,5', { locale: 'de' })).toEqual({ value: 1234.5 });
    expect(readPastedCell(float, '1,5', { locale: 'fr' })).toEqual({ value: 1.5 });
    expect(readPastedCell(float, 'abc', en)).toBeNull();
    expect(readPastedCell(float, '0x1A', en)).toBeNull();
    expect(readPastedCell(float, '1e3', en)).toBeNull();
    // The field's places and kind hold: never rounded, never a fraction in a whole number.
    expect(readPastedCell(float, '1.234', en)).toBeNull();
    expect(readPastedCell(integer, '2.5', en)).toBeNull();
    const price = { type: 'monetary', label: 'Price', currencyField: 'currency_id' } as LineField;
    expect(readPastedCell(price, 'E£ 1,200.00', { locale: 'en', currency: 'EGP' })).toEqual({ value: 1200 });
    expect(readPastedCell(price, '(1,200.00)', { locale: 'en', currency: 'EGP' })).toEqual({ value: -1200 });
    expect(readPastedCell(price, '$ 1,200.00', { locale: 'en', currency: 'EGP' })).toBeNull();
    expect(readPastedCell({ type: 'float', label: 'Share', min: 0 } as LineField, '-3', en)).toBeNull();
    expect(readPastedCell(float, '', en)).toEqual({ value: null });
  });

  it('takes trailing zeros, and a number led by 0 and a decimal comma as a fraction, never a thousand times more', () => {
    const disc = { type: 'float', label: 'Disc. %', digits: [5, 1] } as LineField;
    expect(readPastedCell(disc, '12.50', { locale: 'en' })).toEqual({ value: 12.5 });
    expect(readPastedCell(integer, '1,200.00', { locale: 'en' })).toEqual({ value: 1200 });
    expect(readPastedCell(integer, '12.0', { locale: 'ar' })).toEqual({ value: 12 });
    expect(readPastedCell(float, '0,500', { locale: 'fr' })).toEqual({ value: 0.5 });
    expect(readPastedCell(float, '0,500', { locale: 'en' })).toEqual({ value: 0.5 });
    expect(readPastedCell(float, '٠,٥٠٠', { locale: 'ar' })).toEqual({ value: 0.5 });
    expect(readPastedCell(float, '0.500', { locale: 'de' })).toEqual({ value: 0.5 });
  });

  it('keeps a per cent and hours to their column’s places and least, as their boxes do: never a rounded picture', () => {
    const margin = { type: 'float', label: 'Margin', min: 0 } as LineField;
    const percentage = { locale: 'en' as const, widget: 'percentage' };
    expect(readPastedCell(margin, '12.555', percentage)).toBeNull();
    expect(readPastedCell(margin, '12.55%', percentage)).toEqual({ value: 0.1255 });
    expect(readPastedCell({ ...margin, digits: [5, 1] } as LineField, '12.55', percentage)).toBeNull();
    expect(readPastedCell(margin, '-5', percentage)).toBeNull();
    expect(readPastedCell({ type: 'float', label: 'Margin' } as LineField, '-5', percentage)).toEqual({ value: -0.05 });
    const hours = { type: 'float', label: 'Hours', min: 0 } as LineField;
    const duration = { locale: 'en' as const, widget: 'duration' };
    expect(readPastedCell(hours, '-2:00', duration)).toBeNull();
    expect(readPastedCell(hours, '2:15', duration)).toEqual({ value: 2.25 });
    // "6:3" could be 6:03 or 6:30: not pasted, and named, as any cell that does not read.
    expect(readPastedCell(hours, '6:3', duration)).toBeNull();
  });

  it('never takes a day of an instant in a date’s cell, leaving its time out in silence', () => {
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '2026-10-15T23:30:00Z', { locale: 'en' })).toBeNull();
  });

  it('reads hours and per cents as their boxes do, dates in the page’s order, a choice by its label, words on one line', () => {
    expect(readPastedCell(float, '6:30', { locale: 'en', widget: 'duration' })).toEqual({ value: 6.5 });
    expect(readPastedCell(float, '٢٥٪', { locale: 'ar', widget: 'percentage' })).toEqual({ value: 0.25 });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '13/10/2026', { locale: 'en' })).toEqual({ value: '2026-10-13' });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '١٣/١٠/٢٠٢٦', { locale: 'ar' })).toEqual({ value: '2026-10-13' });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '31/02/2026', { locale: 'en' })).toBeNull();
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '13/10/0002', { locale: 'en' })).toBeNull();
    // A date as Fieldia writes it at rest, copied from another table, reads; a year of two digits is never given a century.
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '15 Oct 2026', { locale: 'en' })).toEqual({ value: '2026-10-15' });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '15 أكتوبر 2026', { locale: 'ar' })).toEqual({ value: '2026-10-15' });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '15/3/85', { locale: 'en' })).toBeNull();
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '10/13/2026', { locale: 'en', dateOrder: 'mdy' })).toEqual({ value: '2026-10-13' });
    // A date and time, as its cell's box keeps one: the instant, never a local time with no zone.
    expect(readPastedCell({ type: 'datetime', label: 'Starts' } as LineField, '13/10/2026 14:30', { locale: 'en' })).toEqual({ value: new Date(2026, 9, 13, 14, 30).toISOString() });
    const state = { type: 'selection', label: 'State', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] } as LineField;
    expect(readPastedCell(state, 'done', { locale: 'en' })).toEqual({ value: 'done' });
    expect(readPastedCell(state, 'DRAFT', { locale: 'en' })).toEqual({ value: 'draft' });
    expect(readPastedCell(state, 'Lost', { locale: 'en' })).toBeNull();
    expect(readPastedCell({ type: 'char', label: 'Item' } as LineField, '‏Chair‏', { locale: 'en' })).toEqual({ value: 'Chair' });
    expect(readPastedCell({ type: 'many2one', label: 'Product', relation: 'product' } as LineField, 'Chair', { locale: 'en' })).toBeNull();
  });
});

describe('why a cell did not take what was pasted', () => {
  const hours = { type: 'float', label: 'Hours', min: 0 } as LineField;
  it.each([
    ['en', 'Hours: “⁨6:3⁩” could be 6:03 or 6:30; write the minutes with two digits', 'Start date takes a day only: the time 14:30 was left out', 'Seats: “⁨abc⁩” is not a number', 'Seats must be a whole number'],
    ['fr', 'Hours : « ⁨6:3⁩ » peut être 6:03 ou 6:30 ; écrivez les minutes avec deux chiffres', 'Start date ne prend qu’un jour : l’heure 14:30 a été laissée de côté', null, null],
  ] as const)('%s: is said in its box’s own words, as typing it and leaving says it', (locale, sixThree, timeLeft, notNumber, whole) => {
    const reading = { locale, labels: WIDGET_LABELS[locale] };
    expect(readPastedCell(hours, '6:3', { ...reading, widget: 'duration' })).toBeNull();
    expect(whyNotPasted(hours, '6:3', { ...reading, widget: 'duration' })).toBe(sixThree);
    const day = { type: 'date', label: 'Start date' } as LineField;
    expect(readPastedCell(day, '13/10/2026 14:30', reading)).toBeNull();
    expect(whyNotPasted(day, '13/10/2026 14:30', reading)).toBe(timeLeft);
    if (notNumber) expect(whyNotPasted(integer, 'abc', reading)).toBe(notNumber);
    if (whole) expect(whyNotPasted(integer, '1.5', reading)).toBe(whole);
    expect(whyNotPasted({ type: 'selection', label: 'Stage', options: [{ value: 'a', label: 'Draft' }] } as LineField, 'Done', reading)).toContain('Done');
    // A link is found by searching: nothing a paste can say of it.
    expect(whyNotPasted({ type: 'many2one', label: 'Client', relation: 'partner' } as LineField, 'Acme', reading)).toBeNull();
  });
});

describe('a spreadsheet’s quoting, and a cell’s most', () => {
  it('reads a quoted cell whole — a tab, a line break, a quote inside — and takes quotes that are no quoting as they are', () => {
    expect(blockOf('"a\tb"\tc\n"x\n""y"""\t2')).toEqual([['a\tb', 'c'], ['x\n"y"', '2']]);
    expect(blockOf('5" screen\t3')).toEqual([['5" screen', '3']]);
    expect(blockOf('"Hello" world\tx')).toEqual([['"Hello" world', 'x']]);
    expect(blockOf('"never closed\t1')).toEqual([['"never closed', '1']]);
    expect(blockOf('a\n\n')).toEqual([['a'], ['']]);
    expect(blockOf('')).toEqual([['']]);
  });

  it('leaves words past their column’s most, and says by how much, one as one', () => {
    const code = { type: 'char', label: 'Code', size: 5 } as LineField;
    const reading = { locale: 'en' as const, labels: WIDGET_LABELS.en };
    expect(readPastedCell(code, 'ABCDE', reading)).toEqual({ value: 'ABCDE' });
    expect(readPastedCell(code, 'ABCDEF', reading)).toBeNull();
    expect(whyNotPasted(code, 'ABCDEF', reading)).toBe('1 character too many');
    expect(whyNotPasted(code, 'ABCDEFGH', reading)).toBe('3 characters too many');
    expect(whyNotPasted(code, 'ABC', reading)).toBeNull();
  });
});
