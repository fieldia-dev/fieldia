import type { Page } from '../format/page';
import * as cells from './cells';
import * as check from './check';
import { createForm, type Form } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { alike, keptSame, type Line, type Values } from './values';
import { recomputeInFull, workCounts } from './work';

/**
 * A record with a table of 200 lines — the owner's walk of 0.35: the draft invoice of 200 lines, 140–210 ms a key on a
 * desktop where its 3 lines took 25–31, in a line and in its header alike — costs a key what one of 3 lines does: the
 * app's server working every line out again changes none that came back the same (`keptSame`), and nothing of a line
 * whose line and rules' reads did not change is checked, read or compared again: its cells' checks, its rules' state,
 * what a value worked out from the lines waits for. Counted, never timed.
 */

afterEach(() => {
  recomputeInFull(false);
  jest.restoreAllMocks();
});

const COLUMNS = { product: { type: 'char', label: 'Product' }, qty: { type: 'float', label: 'Quantity', min: 0 }, price: { type: 'monetary', label: 'Unit price', currency: 'EGP' }, subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', readonly: true } };

function invoice(): Page {
  return {
    fieldia: '0.13',
    id: 'invoice',
    data: { kind: 'record', model: 'account.move' },
    fields: {
      state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
      ref: { type: 'char', label: 'Payment reference' },
      lines: { type: 'one2many', label: 'Lines', relation: 'account.move.line', fields: COLUMNS },
      amount_untaxed: { type: 'monetary', label: 'Untaxed', currency: 'EGP', readonly: true },
      amount_total: { type: 'monetary', label: 'Total', currency: 'EGP', readonly: true },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-state', field: 'state' },
        { type: 'field', id: 'f-ref', field: 'ref' },
        // As Flectra's invoice lines: a cell's rules read the record (`parent.state`).
        { type: 'field', id: 'f-lines', field: 'lines', cells: { price: { readonly: "parent.state == 'posted'" } }, rowTones: [{ tone: 'danger', when: 'qty > 100' }] },
        { type: 'field', id: 'f-untaxed', field: 'amount_untaxed' },
        { type: 'field', id: 'f-total', field: 'amount_total' },
      ],
    },
  } as unknown as Page;
}

const linesOf = (n: number): Line[] => Array.from({ length: n }, (_, i) => ({ key: `l${i + 1}`, id: i + 1, values: { product: `Item ${i + 1}`, qty: (i % 7) + 1, price: 10 + (i % 13), subtotal: ((i % 7) + 1) * (10 + (i % 13)) } }));

/** The app's server, as the demo's invoice is worked out (demos/shared/real/accounting.ts): every line again, and the totals — on every change, the payment reference's too. */
function workedOut(values: Values): Values {
  const lines = ((values['lines'] as Line[]) ?? []).map((line) => ({ ...line, values: { ...line.values, subtotal: Number(line.values['qty']) * Number(line.values['price']) } }));
  const untaxed = lines.reduce((sum, line) => sum + Number(line.values['subtotal']), 0);
  return { lines, amount_untaxed: untaxed, amount_total: Math.round(untaxed * 114) / 100 };
}

async function open(n: number, full = false): Promise<{ form: Form; settled: () => Promise<void> }> {
  const values = { state: 'draft', ref: 'INV/1', lines: linesOf(n), ...workedOut({ lines: linesOf(n) }) };
  const dataSource = createMemoryDataSource({ records: { 'account.move': { 7: values } }, onchange: { 'account.move': { ref: workedOut, lines: workedOut } } });
  recomputeInFull(full);
  const form = createForm({ page: invoice(), dataSource, recordId: 7 });
  recomputeInFull(false);
  await form.load();
  const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => form.settle());
  return { form, settled };
}

/** Each value worked out from the lines asked what it waits for, as the viewer asks at every change: twice. */
const asked = (form: Form) => {
  for (const name of ['amount_untaxed', 'amount_total', 'amount_untaxed', 'amount_total']) form.waitsFor(name);
};

/** What a run does, counted: the cells' checks, the line states read, the values worked out from the lines asked what they wait for. */
async function counted(form: Form, settled: () => Promise<void>, run: () => void) {
  const checking = jest.spyOn(check, 'checkValue');
  const before = workCounts.checks;
  run();
  asked(form);
  await settled();
  asked(form);
  const out = { checkValue: checking.mock.calls.length, checks: workCounts.checks - before };
  checking.mockRestore();
  return out;
}

describe('a record with a table of 200 lines, the app working every line out again at each change', () => {
  it('a key in its header checks none of the lines’ cells: 200 lines as 3', async () => {
    const { form, settled } = await open(200);
    // The key before, as a person types: the form drawn after it (the viewer asks at every change).
    form.setValue('ref', 'INV/1 a');
    asked(form);
    await settled();
    asked(form);
    const header = await counted(form, settled, () => form.setValue('ref', 'INV/1 ab'));
    // 0.35.0 checked every cell of the 200 lines for each value worked out from them, each time it was asked: 6,400.
    expect(header.checkValue).toBeLessThanOrEqual(4);
    expect(header.checks).toBeLessThanOrEqual(2);
  });

  it('a key in a line checks that line’s cells alone', async () => {
    const { form, settled } = await open(200);
    const key = (form.getState().values['lines'] as Line[])[150].key;
    form.updateLine('lines', key, 'qty', 3);
    asked(form);
    await settled();
    asked(form);
    const line = await counted(form, settled, () => form.updateLine('lines', key, 'qty', 31));
    // Its 4 cells and the table's own check, once for the key and once for the server's answer that changed its
    // subtotal: 10, where 0.35.0 checked the 800 cells of the 200 lines for each value worked out from them, each time.
    expect(line.checks).toBeLessThanOrEqual(10);
    expect(line.checkValue).toBeLessThanOrEqual(10);
  });

  it('the server’s answer that works the same lines out again keeps the table and every line the same objects', async () => {
    const { form, settled } = await open(200);
    const before = form.getState().values['lines'] as Line[];
    form.setValue('ref', 'INV/2');
    await settled();
    expect(form.getState().values['lines']).toBe(before);
    const key = before[42].key;
    form.updateLine('lines', key, 'qty', 9);
    await settled();
    const after = form.getState().values['lines'] as Line[];
    expect(after).not.toBe(before);
    expect(after.filter((line, at) => line !== before[at]).map((line) => line.key)).toEqual([key]);
    expect(after[42].values['subtotal']).toBe(9 * Number(after[42].values['price']));
    // Changed, the record says so, as ever; put back as it was, it is not.
    expect(form.getState().dirty).toContain('lines');
  });

  it('a key in its header reads no line’s rules again, and does when what they read of the record changes', async () => {
    let read = 0;
    const real = cells.compileTable;
    jest.spyOn(cells, 'compileTable').mockImplementation((node, functions) => {
      const table = real(node, functions);
      const line = table.line;
      return { ...table, line: (...args: Parameters<typeof line>) => (read++, line(...args)) };
    });
    const { form, settled } = await open(200);
    for (const line of form.getState().values['lines'] as Line[]) form.lineState('f-lines', line.key);
    read = 0;
    form.setValue('ref', 'INV/1 x');
    await settled();
    for (const line of form.getState().values['lines'] as Line[]) form.lineState('f-lines', line.key);
    expect(read).toBe(0);
    form.setValue('state', 'posted');
    await settled();
    for (const line of form.getState().values['lines'] as Line[]) expect(form.lineState('f-lines', line.key).cells['price']?.readonly).toBe(true);
    expect(read).toBe(200);
  });

  it('a value worked out from the lines waits for the first line its check refuses, as worked out in full', async () => {
    const quick = await open(200);
    const full = await open(200, true);
    for (const { form, settled } of [quick, full]) {
      const lines = form.getState().values['lines'] as Line[];
      form.updateLine('lines', lines[150].key, 'qty', -5);
      form.updateLine('lines', lines[170].key, 'qty', -2);
      await settled();
    }
    expect(quick.form.waitsFor('amount_untaxed')).toEqual({ field: 'lines', line: 151, column: 'qty' });
    expect(quick.form.waitsFor('amount_untaxed')).toEqual(full.form.waitsFor('amount_untaxed'));
    for (const { form, settled } of [quick, full]) {
      form.updateLine('lines', (form.getState().values['lines'] as Line[])[150].key, 'qty', 5);
      await settled();
    }
    expect(quick.form.waitsFor('amount_total')).toEqual({ field: 'lines', line: 171, column: 'qty' });
    expect(quick.form.waitsFor('amount_total')).toEqual(full.form.waitsFor('amount_total'));
  });
});

describe('keptSame: what an answer gives back alike stays the form’s own', () => {
  const fields = invoice().fields;

  it('keeps a value alike in every part, whatever order its keys came in, and a table whose lines all are', () => {
    const now: Values = { ref: 'a', partner: { id: 4, label: 'Nile' }, lines: linesOf(3) };
    const next: Values = { ref: 'b', partner: { label: 'Nile', id: 4 }, lines: linesOf(3).map((line) => ({ values: { ...line.values }, id: line.id, key: line.key })) };
    const kept = keptSame(next, now, fields);
    expect(kept['ref']).toBe('b');
    expect(kept['partner']).toBe(now['partner']);
    expect(kept['lines']).toBe(now['lines']);
  });

  it('keeps each line alike by its key, the changed and the new ones as they came, in the order they came', () => {
    const now: Values = { lines: linesOf(3) };
    const given = linesOf(4).reverse();
    given[1] = { ...given[1], values: { ...given[1].values, qty: 99 } };
    const kept = keptSame({ lines: given }, now, fields)['lines'] as Line[];
    expect(kept.map((line) => line.key)).toEqual(['l4', 'l3', 'l2', 'l1']);
    expect(kept[0]).toBe(given[0]);
    expect(kept[1]).toBe(given[1]);
    expect(kept[2]).toBe((now['lines'] as Line[])[1]);
    expect(kept[3]).toBe((now['lines'] as Line[])[0]);
  });

  it('gives `next` itself where nothing is alike, and says alike as JSON would', () => {
    const next: Values = { ref: 'x', lines: [] };
    expect(keptSame(next, { ref: 'y', lines: linesOf(1) }, fields)).toBe(next);
    expect(alike({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(alike([1, { x: [2] }], [1, { x: [2] }])).toBe(true);
    expect(alike({ a: 1 }, { a: '1' })).toBe(false);
    expect(alike(null, undefined)).toBe(true);
    expect(alike([1], { 0: 1 })).toBe(false);
  });
});
