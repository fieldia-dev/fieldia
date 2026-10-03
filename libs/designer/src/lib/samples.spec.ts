import type { Field } from '@fieldia/core';
import { sampleRows, sampleValue } from './samples';

const fields: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  email: { type: 'char', label: 'Email' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }] },
  credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
  country_id: { type: 'many2one', label: 'Country', relation: 'country' },
  opened: { type: 'date', label: 'Opened' },
  vip: { type: 'boolean', label: 'VIP' },
  visits: { type: 'integer', label: 'Visits' },
};

describe('sample values', () => {
  it('fills a row with values of each field’s own kind', () => {
    expect(sampleValue('name', fields['name'], 0)).toBe('Acme Trading');
    expect(sampleValue('email', fields['email'], 0)).toBe('hello@acme.example');
    expect(sampleValue('state', fields['state'], 1)).toBe('blocked');
    expect(typeof sampleValue('credit_limit', fields['credit_limit'], 0)).toBe('number');
    expect(sampleValue('country_id', fields['country_id'], 0)).toEqual({ id: 1, label: 'Country A' });
    expect(sampleValue('opened', fields['opened'], 0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof sampleValue('vip', fields['vip'], 0)).toBe('boolean');
    expect(Number.isInteger(sampleValue('visits', fields['visits'], 2))).toBe(true);
  });

  it('gives different rows different values, the same every time', () => {
    const rows = sampleRows(fields, ['name', 'email', 'state'], 5);
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r['name'])).size).toBe(5);
    expect(sampleRows(fields, ['name', 'email', 'state'], 5)).toEqual(rows);
  });
});
