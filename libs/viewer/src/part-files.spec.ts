/**
 * @jest-environment node
 */
import type { Page } from '@fieldia/core';
import { partFiles } from './server';

/**
 * The one-tag script's files a page draws from, as a server asks for them (`@fieldia/viewer/server`, in Node, with no
 * browser): what it writes as `<script async>` tags before fieldia.js, so they come beside it.
 */
describe('partFiles', () => {
  it('names each file a page draws from — a list’s and its cards’, a date box’s — and none for a plain form', () => {
    const customers = {
      fieldia: '0.11',
      id: 'customers',
      data: { kind: 'record', model: 'partner' },
      fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } },
      layout: { type: 'list', id: 'people', columns: ['name', 'phone'], card: {} },
    } as unknown as Page;
    expect(partFiles(customers)).toEqual(['fieldia.list.js', 'fieldia.cards.js']);
    const visit = { fieldia: '0.11', id: 'visit', data: { kind: 'responses' }, fields: { day: { type: 'date', label: 'Day' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-day', field: 'day' }] } } as unknown as Page;
    expect(partFiles(visit)).toEqual(['fieldia.date.js']);
    expect(partFiles(customers).every((file) => /^fieldia\.[a-z]+\.js$/.test(file))).toBe(true);
    const plain = { fieldia: '0.11', id: 'call', data: { kind: 'responses' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] } } as unknown as Page;
    expect(partFiles(plain)).toEqual([]);
  });
});
