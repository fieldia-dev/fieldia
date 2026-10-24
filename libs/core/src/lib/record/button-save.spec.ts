import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { DataSource } from './data-source';
import { later } from './test-steps';

/**
 * A record's button that moves its status and saves — Confirm, Approve,
 * Register payment — does nothing to a record that cannot be saved, as a
 * Flectra button does: the record is saved first, and when that save, or the
 * steps' own, is refused, the status stays where it was and the fields it
 * locks stay open to put right.
 */

/** An invoice: a customer it needs, a status its buttons move, the customer locked once it is posted. */
function invoicePage(): Page {
  const page: Page = {
    fieldia: '0.13',
    id: 'invoice',
    data: { kind: 'record', model: 'invoice' },
    fields: {
      partner_id: { type: 'many2one', label: 'Customer', relation: 'partner', required: true },
      reference: { type: 'char', label: 'Reference' },
      state: {
        type: 'selection',
        label: 'Status',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'posted', label: 'Posted' },
          { value: 'paid', label: 'Paid' },
        ],
        default: 'draft',
      },
    },
    layout: {
      type: 'sheet',
      id: 'sheet',
      statusbar: { field: 'state' },
      buttons: [
        { type: 'button', id: 'b-confirm', label: 'Confirm', steps: [{ do: 'set', field: 'state', value: "'posted'" }, { do: 'save' }], invisible: "state != 'draft'" },
        { type: 'button', id: 'b-pay', label: 'Register payment', steps: [{ do: 'set', field: 'state', value: "'paid'" }, { do: 'save' }], invisible: "state != 'posted'" },
        { type: 'button', id: 'b-approve', label: 'Approve', steps: [{ do: 'set', field: 'state', value: "'posted'" }, { do: 'call', action: 'approve' }, { do: 'save' }], invisible: "state != 'draft'" },
        { type: 'button', id: 'b-note', label: 'Note it', steps: [{ do: 'set', field: 'reference', value: "'noted'" }], invisible: "state != 'draft'" },
      ],
      children: [
        { type: 'field', id: 'f-partner', field: 'partner_id', readonly: "state != 'draft'" },
        { type: 'field', id: 'f-reference', field: 'reference' },
      ],
    },
  };
  const checked = checkPage(page);
  if (!checked.ok) throw new Error(checked.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return page;
}

function source(records: Record<string, Record<string, unknown>> = {}) {
  return createMemoryDataSource({ records: { invoice: records, partner: { 1: { name: 'Nile Traders' } } } as never });
}

describe('a record’s button that saves', () => {
  it('on a new record that cannot be saved: the status stays Draft, the customer stays open, and the save says why', async () => {
    const saves: unknown[] = [];
    const memory = source();
    const dataSource: DataSource = { ...memory, save: (request) => (saves.push(request), memory.save!(request)) };
    const form = createForm({ page: invoicePage(), dataSource });
    await form.load();
    const result = await form.runAction('b-confirm');
    expect(result).toEqual(expect.objectContaining({ done: false, reason: 'save', message: 'Customer is required' }));
    expect(form.getState().values['state']).toBe('draft');
    expect(form.fieldReadonly('partner_id')).toBe(false);
    expect(form.node('f-partner').readonly).toBe(false);
    expect(form.getState().errors).toEqual({ partner_id: 'Customer is required' });
    expect(saves).toEqual([]);
    // Register payment, which shows only once it is posted, stays hidden: nothing moved.
    expect(form.node('b-pay').invisible).toBe(true);
    // Put right, the same press confirms it and saves it once posted.
    form.setValue('partner_id', { id: 1, label: 'Nile Traders' });
    expect((await form.runAction('b-confirm')).done).toBe(true);
    expect(form.getState().values['state']).toBe('posted');
    expect(form.getState().dirty).toEqual([]);
    const id = form.getState().recordId as number;
    expect(memory.records['invoice'][id]).toEqual(expect.objectContaining({ state: 'posted' }));
  });

  it('the app is not asked to approve a record that cannot be saved', async () => {
    const asked: string[] = [];
    const form = createForm({ page: invoicePage(), dataSource: source(), onAction: (request) => void asked.push(request.action) });
    await form.load();
    expect((await form.runAction('b-approve')).reason).toBe('save');
    expect(asked).toEqual([]);
    expect(form.getState().values['state']).toBe('draft');
  });

  it('a saved record whose save the source refuses: what the steps set is put back, and nothing is left to save', async () => {
    const memory = source({ 4: { partner_id: { id: 1, label: 'Nile Traders' }, state: 'draft' } });
    const dataSource: DataSource = { ...memory, save: () => Promise.reject(new Error('The books are closed for October')) };
    const form = createForm({ page: invoicePage(), dataSource, recordId: 4 });
    await form.load();
    const result = await form.runAction('b-confirm');
    expect(result).toEqual(expect.objectContaining({ done: false, stoppedAt: 1, reason: 'save', message: 'The books are closed for October' }));
    expect(form.getState().values['state']).toBe('draft');
    expect(form.getState().dirty).toEqual([]);
    expect(form.node('f-partner').readonly).toBe(false);
  });

  it('a record changed before the press is saved first, then the status moves; the steps’ save refused puts back only theirs', async () => {
    const memory = source({ 4: { partner_id: { id: 1, label: 'Nile Traders' }, state: 'draft', reference: 'old' } });
    let saves = 0;
    // The record saves; the steps' save after it is refused.
    const dataSource: DataSource = { ...memory, save: (request) => (++saves === 1 ? memory.save!(request) : Promise.reject(new Error('Refused'))) };
    const form = createForm({ page: invoicePage(), dataSource, recordId: 4 });
    await form.load();
    form.setValue('reference', 'INV-7');
    const result = await form.runAction('b-confirm');
    expect(result.reason).toBe('save');
    expect(saves).toBe(2);
    expect(memory.records['invoice'][4]).toEqual(expect.objectContaining({ reference: 'INV-7', state: 'draft' }));
    expect(form.getState().values).toEqual(expect.objectContaining({ reference: 'INV-7', state: 'draft' }));
    expect(form.getState().dirty).toEqual([]);
  });

  it('a person’s own change a step wrote over is theirs again once it is put back: still at risk, still asked about', async () => {
    const memory = source({ 4: { partner_id: { id: 1, label: 'Nile Traders' }, state: 'draft', reference: 'old' } });
    let refuse = false;
    const dataSource: DataSource = { ...memory, save: (request) => (refuse ? Promise.reject(new Error('Refused')) : memory.save!(request)) };
    const form = createForm({ page: invoicePage(), dataSource, recordId: 4 });
    await form.load();
    form.setValue('reference', 'first');
    expect(await form.save()).toBe(true);
    refuse = true;
    form.setValue('reference', 'mine');
    expect(form.getState().unsent).toEqual(['reference']);
    expect((await form.run([{ do: 'set', field: 'reference', value: "'the run’s'" }, { do: 'save' }])).reason).toBe('save');
    expect(form.getState().values['reference']).toBe('mine');
    expect(form.getState().dirty).toEqual(['reference']);
    expect(form.getState().unsent).toEqual(['reference']);
  });

  it('what someone changed while the steps’ save was on its way is kept, never put back over', async () => {
    const memory = source({ 4: { partner_id: { id: 1, label: 'Nile Traders' }, state: 'draft' } });
    const held = later();
    const dataSource: DataSource = { ...memory, save: () => held.promise.then(() => Promise.reject(new Error('Refused'))) };
    const form = createForm({ page: invoicePage(), dataSource, recordId: 4 });
    await form.load();
    const pressed = form.runAction('b-confirm');
    // What is typed is read first (nothing, here), then the steps run to their save, which is held.
    for (let tick = 0; tick < 20 && form.getState().values['state'] !== 'posted'; tick++) await Promise.resolve();
    expect(form.getState().values['state']).toBe('posted');
    // The app moves it on meanwhile: that is not the button's to undo.
    form.setValues({ state: 'paid' });
    held.resolve();
    expect((await pressed).reason).toBe('save');
    expect(form.getState().values['state']).toBe('paid');
  });

  it('a button that does not save keeps what it set, as before', async () => {
    const form = createForm({ page: invoicePage(), dataSource: source() });
    await form.load();
    expect((await form.runAction('b-note')).done).toBe(true);
    expect(form.getState().values['reference']).toBe('noted');
  });

  it('steps the app runs that save are one piece of work too: a refused save puts back what they set', async () => {
    const form = createForm({ page: invoicePage(), dataSource: source() });
    await form.load();
    const result = await form.run([{ do: 'set', field: 'reference', value: "'set by the run'" }, { do: 'set', field: 'state', value: "'posted'" }, { do: 'save' }]);
    expect(result).toEqual(expect.objectContaining({ done: false, stoppedAt: 2, reason: 'save', message: 'Customer is required' }));
    expect(form.getState().values['state']).toBe('draft');
    expect(form.getState().values['reference']).toBeNull();
  });
});
