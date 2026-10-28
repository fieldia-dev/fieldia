import type { Page } from '../format/page';
import type { Field } from '../format/field';
import { FORMAT_VERSION } from '../format/version';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { dayIn } from './zones';
import type { Line } from './values';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A field a copy does not keep (`copy: false`, Odoo's `copy=False`): the data source's copy holds the field as a new
 * record starts it — its `default`, or what its `defaultFrom` works out — else empty, and a table's line field that says
 * it so in each copied line, as a new line starts it. The memory source applies it; Fieldia never writes to a copy after
 * making it.
 */

const STATUS = [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }];

/** A vendor bill: its number, its status, its day, a note and its lines. */
const bill = (state: Partial<Field> = {}, more: Record<string, Partial<Field>> = {}): Page =>
  ({
    fieldia: FORMAT_VERSION,
    id: 'bill',
    data: { kind: 'record', model: 'account.move' },
    fields: {
      name: { type: 'char', label: 'Number', ...more['name'] },
      state: { type: 'selection', label: 'Status', options: STATUS, default: 'draft', ...state },
      invoice_date: { type: 'date', label: 'Bill date', ...more['invoice_date'] },
      ref: { type: 'char', label: 'Reference', ...more['ref'] },
      payment_reference: { type: 'char', label: 'Payment reference', ...more['payment_reference'] },
      lines: {
        type: 'one2many',
        label: 'Lines',
        relation: 'account.move.line',
        fields: {
          product: { type: 'char', label: 'Product' },
          quantity: { type: 'float', label: 'Quantity', default: 1, ...more['quantity'] },
          lot: { type: 'char', label: 'Lot', ...more['lot'] },
        },
        ...more['lines'],
      },
    },
    layout: { type: 'sheet', id: 'sheet', toolbar: { menu: [{ id: 'm-duplicate', builtin: 'duplicate' }] }, statusbar: { field: 'state' }, children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-lines', field: 'lines' }] },
  }) as unknown as Page;

const posted = () =>
  createMemoryDataSource({
    records: {
      'account.move': {
        1: {
          name: 'BILL/2026/10/0001',
          state: 'posted',
          invoice_date: '2026-10-01',
          ref: 'INV-778',
          payment_reference: 'BILL/2026/10/0001',
          lines: [
            { key: 'l1', id: 11, values: { product: 'Desk', quantity: 2, lot: 'LOT-A' } },
            { key: 'l2', id: 12, values: { product: 'Chair', quantity: 6, lot: 'LOT-B' } },
          ] satisfies Line[],
        },
      },
    },
  });

describe('a field a copy does not keep: the memory source’s copy', () => {
  it('copies a posted bill as a draft where its status says copy: false, and as posted where it says nothing', async () => {
    for (const [page, state] of [[bill({ copy: false }), 'draft'], [bill(), 'posted'], [bill({ copy: true }), 'posted']] as const) {
      expect(validatePage(page)).toMatchObject({ ok: true });
      const source = posted();
      const made = await source.copy({ model: 'account.move', id: 1, fields: page.fields });
      expect(made.values?.['state']).toBe(state);
      expect(source.records['account.move'][String(made.id)]['state']).toBe(state);
      // What it keeps, it keeps: its number with " (copy)", its lines anew.
      expect(made.values?.['name']).toBe('BILL/2026/10/0001 (copy)');
      expect(made.values?.['ref']).toBe('INV-778');
    }
  });

  it('starts each field that says copy: false as a new record starts it — its default, a day’s “today”, what its defaultFrom works out — else empty', async () => {
    const page = bill(
      { copy: false },
      {
        invoice_date: { copy: false, default: 'today' },
        ref: { copy: false },
        payment_reference: { copy: false, defaultFrom: "'Pay ' + state" },
      }
    );
    const source = posted();
    const made = await source.copy({ model: 'account.move', id: 1, fields: page.fields });
    // As a new record works it out: from a new record's values (its state a draft), never from the bill copied.
    expect(made.values).toMatchObject({ state: 'draft', invoice_date: dayIn(new Date()), ref: null, payment_reference: 'Pay draft' });
    expect(source.records['account.move'][String(made.id)]).toMatchObject({ state: 'draft', invoice_date: dayIn(new Date()), ref: null, payment_reference: 'Pay draft' });
    // A number a copy does not keep is a new record's, with no " (copy)" after it: Odoo's draft bill's "/".
    const numbered = await posted().copy({ model: 'account.move', id: 1, fields: bill({}, { name: { copy: false, default: '/' } }).fields });
    expect(numbered.values?.['name']).toBe('/');
    // The bill copied is as it was.
    expect(source.records['account.move'][1]).toMatchObject({ state: 'posted', invoice_date: '2026-10-01', ref: 'INV-778', payment_reference: 'BILL/2026/10/0001' });
  });

  it('starts a line field that says copy: false in each copied line as a new line starts it; a table that says it is not copied at all', async () => {
    const source = posted();
    const lots = bill({}, { lot: { copy: false }, quantity: { copy: false } });
    const made = await source.copy({ model: 'account.move', id: 1, fields: lots.fields });
    const lines = made.values?.['lines'] as Line[];
    expect(lines.map((line) => line.values)).toEqual([
      { product: 'Desk', quantity: 1, lot: null },
      { product: 'Chair', quantity: 1, lot: null },
    ]);
    // New lines of the copy's own, with new ids.
    expect(lines.map((line) => line.id)).not.toContain(11);
    expect((source.records['account.move'][1]['lines'] as Line[]).map((line) => line.values['lot'])).toEqual(['LOT-A', 'LOT-B']);
    const none = await posted().copy({ model: 'account.move', id: 1, fields: bill({}, { lines: { copy: false } }).fields });
    expect(none.values?.['lines']).toEqual([]);
  });

  it('copies the vendor-bill demo’s posted bill as a draft by its page alone: its status says copy: false, its first value a draft — and its bill and payment references start empty', async () => {
    const page = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages', 'vendor-bill.page.json'), 'utf8')) as Page;
    expect(page.fields['state']).toMatchObject({ default: 'draft', copy: false });
    // As Odoo's `ref` and `payment_reference` (copy=False): a payment quoting the copy never names the posted bill.
    expect(page.fields['ref']).toMatchObject({ copy: false });
    expect(page.fields['payment_reference']).toMatchObject({ copy: false });
    expect(page.fieldia).toBe('0.14');
    const source = createMemoryDataSource({ records: { 'account.move': { 3: { name: 'BILL/2026/10/0003', state: 'posted', ref: 'NT-8907', payment_reference: 'BILL/2026/10/0003', invoice_date_due: '2026-11-04' } } } });
    const made = await source.copy({ model: 'account.move', id: 3, fields: page.fields });
    expect(made.values).toMatchObject({ name: 'BILL/2026/10/0003 (copy)', state: 'draft', ref: null, payment_reference: null, invoice_date_due: '2026-11-04' });
    expect(source.records['account.move'][String(made.id)]).toMatchObject({ state: 'draft', ref: null, payment_reference: null });
    // The posted bill keeps its own.
    expect(source.records['account.move'][3]).toMatchObject({ state: 'posted', ref: 'NT-8907', payment_reference: 'BILL/2026/10/0003' });
  });

  it('is one act: Duplicate shows the copy as its source made it, and Fieldia writes nothing to it after', async () => {
    const source = posted();
    const form = createForm({ page: bill({ copy: false }), dataSource: source, recordId: 1 });
    await form.load();
    expect(form.getState().values['state']).toBe('posted');
    expect(await form.runAction('m-duplicate')).toEqual({ done: true });
    expect(form.getState().recordId).toBe(2);
    expect(form.getState().values['state']).toBe('draft');
    expect(form.getState().dirty).toEqual([]);
    expect(source.calls.map((call) => call.method)).toEqual(['load', 'copy', 'load']);
  });
});
