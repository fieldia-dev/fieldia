import type { LineField } from '@fieldia/core';
import { blockOf, readPastedCell } from './cell-paste';

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

  it('reads hours and per cents as their boxes do, dates in the page’s order, a choice by its label, words on one line', () => {
    expect(readPastedCell(float, '6:30', { locale: 'en', widget: 'duration' })).toEqual({ value: 6.5 });
    expect(readPastedCell(float, '٢٥٪', { locale: 'ar', widget: 'percentage' })).toEqual({ value: 0.25 });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '13/10/2026', { locale: 'en' })).toEqual({ value: '2026-10-13' });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '١٣/١٠/٢٠٢٦', { locale: 'ar' })).toEqual({ value: '2026-10-13' });
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '31/02/2026', { locale: 'en' })).toBeNull();
    expect(readPastedCell({ type: 'date', label: 'Due' } as LineField, '13/10/0002', { locale: 'en' })).toBeNull();
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
