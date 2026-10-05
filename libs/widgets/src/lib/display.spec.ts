import type { LineField } from '@fieldia/core';
import { displayValue } from './display';

/**
 * An amount at rest — in a table's total, a grid's cell, a list — wears its
 * currency the way its own box does: the symbol, where the page's language
 * writes it, in Latin digits as business software in Arabic shows them.
 */

const money = (extra: Partial<LineField> = {}) => ({ type: 'monetary', label: 'Amount', ...extra }) as LineField;
const plain = (text: string) => text.replace(/[\u200e\u200f\u00a0\u202f]/g, (c) => (c === '\u00a0' || c === '\u202f' ? ' ' : ''));

describe('an amount at rest', () => {
  it('wears its currency’s symbol where the page’s language writes it, as its box does', () => {
    expect(displayValue(money({ currency: 'EGP' }), 425000)).toBe('E£425,000.00');
    expect(displayValue(money({ currency: 'USD' }), 1850000.5)).toBe('$1,850,000.50');
    expect(plain(displayValue(money({ currency: 'EUR' }), 1850000.5, {}, 'de'))).toBe('1.850.000,50 €');
    expect(plain(displayValue(money({ currency: 'EGP' }), 425000, {}, 'ar'))).toBe('425,000.00 E£');
  });

  it('keeps the field’s decimals, and a currency named by a record’s words as written', () => {
    expect(displayValue(money({ currency: 'EGP', digits: [16, 0] } as Partial<LineField>), 425000)).toBe('E£425,000');
    const byRecord = money({ currencyField: 'currency_id' } as Partial<LineField>);
    expect(displayValue(byRecord, 12, { currency_id: { id: 1, label: 'USD' } })).toBe('$12.00');
    expect(displayValue(byRecord, 12, { currency_id: { id: 2, label: 'Egyptian pound' } })).toBe('Egyptian pound 12.00');
    expect(displayValue(money(), 12)).toBe('12.00');
  });
});
