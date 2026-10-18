import type { Page, Values } from '@fieldia/core';

/**
 * Two tables of lines drawn by the grid with no lines yet, for e2e/grid-empty.spec.ts: one with a totals row under its
 * lines, one without. Each says it is empty in its body, clear of its header and of the totals. No card in the gallery.
 */

const lineFields = {
  product: { type: 'char', label: 'Product' },
  qty: { type: 'float', label: 'Quantity', digits: [8, 2] },
  price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
  subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', readonly: true },
};

export const emptyGridsPage = {
  fieldia: '0.5',
  id: 'empty-grids',
  title: 'Tables of lines with nothing on them yet',
  data: { kind: 'record', model: 'demo.lines' },
  fields: {
    name: { type: 'char', label: 'Name' },
    line_ids: { type: 'one2many', label: 'Order lines', relation: 'demo.line', fields: lineFields },
    note_ids: { type: 'one2many', label: 'Delivery notes', relation: 'demo.note', fields: { date: { type: 'date', label: 'Date' }, words: { type: 'char', label: 'Note' } } },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      {
        type: 'section',
        id: 'with-totals',
        title: 'With a totals row',
        children: [{ type: 'field', id: 'f-lines', field: 'line_ids', widget: 'grid', totals: ['qty', 'subtotal'] }],
      },
      {
        type: 'section',
        id: 'without-totals',
        title: 'Without one',
        children: [{ type: 'field', id: 'f-notes', field: 'note_ids', widget: 'grid' }],
      },
    ],
  },
} as unknown as Page;

/** Its one record, its tables empty. */
export const emptyGridsRecords: Record<string, Record<number, Values>> = {
  'demo.lines': { 1: { name: 'A quotation with nothing on it yet', line_ids: [], note_ids: [] } },
};
